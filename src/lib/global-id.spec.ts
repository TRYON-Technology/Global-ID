/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  default as GlobalId,
  Decoder,
  Encoder,
  IParser,
  ParserRegistry,
  TypeRegistry,
} from './global-id';

class OrganizationLegacyIdentifierParserV1
  implements IParser<{ id: string; systemId: string }>
{
  parse(value: string): { id: string; systemId: string } {
    return JSON.parse(value);
  }

  format(value: { id: string; systemId: string }): string {
    return JSON.stringify(value);
  }
}

describe('GlobalId Encoding and Decoding', () => {
  let typeRegistry: TypeRegistry;
  let parserRegistry: ParserRegistry;
  let encoder: Encoder;
  let decoder: Decoder;

  beforeEach(() => {
    typeRegistry = new TypeRegistry();
    parserRegistry = new ParserRegistry(typeRegistry);
    encoder = new Encoder(parserRegistry, typeRegistry);
    decoder = new Decoder(parserRegistry, typeRegistry);

    typeRegistry.registerType('Organization', 'org');
    parserRegistry.registerParser(
      'org',
      '1.0.0',
      new OrganizationLegacyIdentifierParserV1()
    );
  });

  test('should encode a GlobalId', () => {
    const globalId = new GlobalId('Organization', '1.0.0', {
      id: 'uuid',
      systemId: '123',
    });
    const encoded = encoder.encode(globalId);
    expect(encoded).toContain('org_');
  });

  test('should decode a GlobalId', () => {
    const globalId = new GlobalId('Organization', '1.0.0', {
      id: 'uuid',
      systemId: '123',
    });
    const encoded = encoder.encode(globalId);
    const decoded = decoder.decode(encoded);
    expect(decoded.getType()).toBe('Organization');
    expect(decoded.getVersion()).toBe('1.0.0');

    const parser = new OrganizationLegacyIdentifierParserV1();
    const formattedValue = parser.format({ id: 'uuid', systemId: '123' });
    const parsedValue = parser.parse(formattedValue);
    expect(decoded.getValue()).toEqual(parsedValue);
  });

  test('should throw when registering a parser for an unregistered type', () => {
    expect(() => {
      parserRegistry.registerParser(
        'unregisteredType',
        '1.0.0',
        new OrganizationLegacyIdentifierParserV1()
      );
    }).toThrow();
  });

  test('should throw when decoding an encodedId with an unregistered type prefix', () => {
    const encodedId =
      'unregisteredType_eyJpZCI6InV1aWQiLCJzeXN0ZW1JZCI6IjEyMyJ9'; // Encoded data for an unregistered type
    expect(() => {
      decoder.decode(encodedId);
    }).toThrow();
  });

  test('should throw when decoding an encodedId with an unregistered version', () => {
    const encodedId =
      'org_eyJpZCI6InV1aWQiLCJzeXN0ZW1JZCI6IjEyMyIsIl92ZXJzaW9uIjoiMi4wLjAifQ=='; // Encoded data for an unregistered version
    expect(() => {
      decoder.decode(encodedId);
    }).toThrow();
  });

  test('should handle encoding of string objects', () => {
    const str = '_someIdentif1er';
    const globalId = new GlobalId('Organization', '1.0.0', str);
    const encoded = encoder.encode(globalId);
    expect(encoded).toContain('org_');
  });

  test('should handle encoding of complex objects', () => {
    const complexData = {
      id: 'uuid',
      systemId: '123',
      details: { name: 'Acme Corp', foundedYear: 1999 },
    };
    const globalId = new GlobalId('Organization', '1.0.0', complexData);
    const encoded = encoder.encode(globalId);
    expect(encoded).toContain('org_');
  });

  test('should handle decoding of complex objects', () => {
    const complexData = {
      id: 'uuid',
      systemId: '123',
      details: { name: 'Acme Corp', foundedYear: 1999 },
    };
    const globalId = new GlobalId('Organization', '1.0.0', complexData);
    const encoded = encoder.encode(globalId);
    const decoded = decoder.decode(encoded);
    expect(decoded.getType()).toBe('Organization');
    expect(decoded.getVersion()).toBe('1.0.0');
    expect(decoded.getValue()).toEqual(complexData);
  });

  test('should throw if encodedId is malformed', () => {
    const malformedEncodedId = 'org_malformed'; // Malformed encoded ID
    expect(() => {
      decoder.decode(malformedEncodedId);
    }).toThrow();
  });

  test('should throw if encodedId version does not match any registered parser', () => {
    expect(() => {
      const globalId = new GlobalId('Organization', '99.99.99', {
        id: 'uuid',
        systemId: '123',
      });
      const encoded = encoder.encode(globalId);
      decoder.decode(encoded);
    }).toThrow();
  });

  test('should throw if encodedId is corrupted after encoding', () => {
    expect(() => {
      const globalId = new GlobalId('Organization', '1.0.0', {
        id: 'uuid',
        systemId: '123',
      });
      const encoded = encoder.encode(globalId);
      const corruptedEncodedId = encoded.replace('org_', 'org_corrupted_'); // Corrupt the encoded ID
      decoder.decode(corruptedEncodedId);
    }).toThrow();
  });

  test('should throw if attempting to decode a non-string value', () => {
    // @ts-expect-error: Testing runtime error for passing a non-string value
    expect(() => decoder.decode(null)).toThrow();
    // @ts-expect-error: Testing runtime error for passing a non-string value
    expect(() => decoder.decode(123)).toThrow();
  });

  test('should throw if trying to encode null value', () => {
    expect(() => {
      const globalId = new GlobalId('Organization', '1.0.0', null);
      encoder.encode(globalId);
    }).toThrow();
  });

  test('should throw if trying to decode an empty string', () => {
    expect(() => {
      decoder.decode('');
    }).toThrow();
  });

  test('should throw if the type prefix is invalid', () => {
    expect(() => {
      decoder.decode('invalidType_');
    }).toThrow();
  });

  test('should encode and decode data with special characters', () => {
    const specialCharData = { id: 'uuid', systemId: '!@#$%^&*()' };
    const globalId = new GlobalId('Organization', '1.0.0', specialCharData);
    const encoded = encoder.encode(globalId);
    const decoded = decoder.decode(encoded);
    expect(decoded.getValue()).toEqual(specialCharData);
  });

  test('should handle concurrent encoding and decoding', async () => {
    const globalId = new GlobalId('Organization', '1.0.0', {
      id: 'uuid',
      systemId: '123',
    });
    const encodedPromises = Array(100)
      .fill(null)
      .map(() => Promise.resolve(encoder.encode(globalId)));
    const encodedResults = await Promise.all(encodedPromises);
    encodedResults.forEach((encoded) => {
      expect(() => {
        decoder.decode(encoded);
      }).not.toThrow();
    });
  });
});
