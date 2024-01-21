/* eslint-disable @typescript-eslint/no-explicit-any */

import { encode as cborEncode, decode as cborDecode } from 'cbor-x';
import { brotliCompressSync, brotliDecompressSync } from 'zlib';

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

export interface IParser {
  parse(value: any): string;
}

export class ParserRegistry {
  private parsers: Record<string, Map<string, IParser>> = {};

  constructor(private typeRegistry: TypeRegistry) {}

  registerParser(type: string, version: string, parser: IParser): void {
    if (!this.typeRegistry.getType(type)) {
      throw new Error(`Type "${type}" is not registered in the TypeRegistry.`);
    }
    if (!this.parsers[type]) {
      this.parsers[type] = new Map();
    }
    this.parsers[type].set(version, parser);
  }

  getParser(type: string, version: string): IParser {
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
  constructor(private typeRegistry: TypeRegistry) {}

  encode<T>(id: GlobalId<T>): string {
    const typePrefix = this.typeRegistry.getPrefix(id.getType());
    if (!typePrefix) {
      throw new Error(`Type "${id.getType()}" is not registered.`);
    }

    if (!id.getValue()) {
      throw new Error(`Value is not defined.`);
    }

    // Ensure that valueWithVersion is serialized to a Buffer
    const valueWithVersion = {
      value: id.getValue(),
      _version: id.getVersion(),
    };
    const cborData = cborEncode(valueWithVersion);

    // Compress the CBOR data
    const compressedValue = brotliCompressSync(cborData);

    // Convert the compressed value to a base64 string
    const base64EncodedValue = compressedValue.toString('base64');

    const sanitizedBase64EncodedValue = base64EncodedValue
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${typePrefix}_${sanitizedBase64EncodedValue}`;
  }
}

export class Decoder {
  constructor(
    private parserRegistry: ParserRegistry,
    private typeRegistry: TypeRegistry
  ) {}

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

  decode(encodedId: string): { type: string; version: string; value: string } {
    const [typePrefix, encodedValue] = this.splitByFirstOccurrence(
      encodedId,
      '_'
    );

    let paddedEncodedValue = encodedValue.replace(/-/g, '+').replace(/_/g, '/');

    // Pad the string with '=' to make the length a multiple of 4
    while (paddedEncodedValue.length % 4) {
      paddedEncodedValue += '=';
    }

    // Decompress and decode the value to get the version and the actual value
    const encodedValueBuffer = Buffer.from(paddedEncodedValue, 'base64');
    const decompressedData = brotliDecompressSync(encodedValueBuffer);
    const decodedData = cborDecode(decompressedData) as any;
    const version = decodedData._version;
    const value = decodedData.value;

    // Retrieve the correct parser based on the type prefix and version
    const parser = this.parserRegistry.getParser(typePrefix, version);

    // Parse the value part of the data using the parser
    const parsedValue = parser.parse(value);

    const parsedType = this.typeRegistry.getType(typePrefix);
    if (!parsedType) {
      throw new Error(
        `Prefix "${typePrefix}" is not registered in the TypeRegistry.`
      );
    }

    // Return the type, version, and parsed value
    return {
      type: parsedType,
      version,
      value: parsedValue,
    };
  }
}
