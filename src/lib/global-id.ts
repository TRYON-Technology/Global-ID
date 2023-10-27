/* eslint-disable @typescript-eslint/no-explicit-any */

import { encode as cborEncode, decode as cborDecode } from 'cbor-x';

export default class GlobalId<T> {
  private readonly value: T;
  private readonly version: string;
  private readonly type: string;

  constructor(type: string, version: string, value: T) {
    this.type = type;
    this.version = version;
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }

  getVersion(): string {
    return this.version;
  }

  getType(): string {
    return this.type;
  }
}

export interface IParser<T = any> {
  parse(value: string): T;
  format(value: T): string;
}

export class StringParser implements IParser<string> {
  parse(value: string): string {
    return value;
  }

  format(value: string): string {
    return value;
  }
}

export class ParserRegistry {
  private parsers: Record<string, Map<string, IParser>> = {};

  constructor(private typeRegistry: TypeRegistry) { }

  registerParser<T>(type: string, version: string, parser: IParser<T>): void {
    if (!this.typeRegistry.getType(type)) {
      throw new Error(`Type "${type}" is not registered in the TypeRegistry.`);
    }
    if (!this.parsers[type]) {
      this.parsers[type] = new Map();
    }
    this.parsers[type].set(version, parser);
  }

  getParser<T>(type: string, version: string): IParser<T> {
    const versionedParsers = this.parsers[type];
    if (!versionedParsers) {
      throw new Error(`No parsers registered for type "${type}".`);
    }
    const parser = versionedParsers.get(version);
    if (!parser) {
      throw new Error(
        `No parser registered for type "${type}" and version "${version}".`
      );
    }
    return parser;
  }
}

export class TypeRegistry {
  private typeMap: Record<string, string> = {};
  private prefixMap: Record<string, string> = {};

  registerType(type: string, prefix: string): void {
    if (this.typeMap[type] || this.prefixMap[prefix]) {
      throw new Error(`Type or prefix is already registered.`);
    }
    this.typeMap[type] = prefix;
    this.prefixMap[prefix] = type;
  }

  getPrefix(type: string): string | undefined {
    return this.typeMap[type];
  }

  getType(prefix: string): string | undefined {
    return this.prefixMap[prefix];
  }
}

export class Encoder {
  constructor(
    private parserRegistry: ParserRegistry,
    private typeRegistry: TypeRegistry
  ) { }

  encode<T>(id: GlobalId<T>): string {
    const typePrefix = this.typeRegistry.getPrefix(id.getType());
    if (!typePrefix) {
      throw new Error(`Type "${id.getType()}" is not registered.`);
    }

    if (!id.getValue()) {
      throw new Error(`Value is not defined.`);
    }

    const parser = this.parserRegistry.getParser<T>(
      typePrefix,
      id.getVersion()
    );
    const formattedValue = parser.format(id.getValue());

    const payload = [formattedValue, id.getVersion()];

    const compressedPayload = cborEncode(payload);
    const base64EncodedPayload = toBase64(compressedPayload);

    const sanitizedBase64EncodedPayload = base64EncodedPayload
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${typePrefix}_${sanitizedBase64EncodedPayload}`;
  }
}

export class Decoder {
  constructor(
    private parserRegistry: ParserRegistry,
    private typeRegistry: TypeRegistry
  ) { }

  private splitByFirstOccurrence = (
    input: string,
    separator: string
  ): string[] => {
    const separatorIndex = input.indexOf(separator);
    if (separatorIndex === -1) {
      return [input];
    }
    const part1 = input.slice(0, separatorIndex);
    const part2 = input.slice(separatorIndex + 1);
    return [part1, part2];
  };

  decode<T>(encodedId: string): GlobalId<T> {
    const [typePrefix, encodedPayload] = this.splitByFirstOccurrence(
      encodedId,
      '_'
    );

    let paddedEncodedPayload = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Pad the string with '=' to make the length a multiple of 4
    while (paddedEncodedPayload.length % 4) {
      paddedEncodedPayload += '=';
    }

    // Decompress and decode the value to get the version and the actual value
    const encodedPayloadBuffer = Buffer.from(paddedEncodedPayload, 'base64');
    const [data, version] = cborDecode(encodedPayloadBuffer) as Array<any>;

    // Retrieve the correct parser based on the type prefix and version
    const parser = this.parserRegistry.getParser(typePrefix, version);

    // Parse the value part of the data using the parser
    const parsedValue = parser.parse(data) as T;

    const parsedType = this.typeRegistry.getType(typePrefix);
    if (!parsedType) {
      throw new Error(
        `Prefix "${typePrefix}" is not registered in the TypeRegistry.`
      );
    }

    // Return the type, version, and parsed value
    return new GlobalId<T>(parsedType, version, parsedValue);
  }
}

function toBase64(buffer: Buffer | Uint8Array): string {
  if (isNodeBuffer(buffer)) {
    // Node.js environment
    return buffer.toString('base64');
  } else if (buffer instanceof Uint8Array) {
    // Browser environment
    return uint8ArrayToBase64(buffer);
  } else {
    throw new Error('Unsupported input type for base64 conversion');
  }
}

function isNodeBuffer(buffer: any): buffer is Buffer {
  return typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer);
}

function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return window.btoa(binary);
}
