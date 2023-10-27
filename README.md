# @tryon-technology/global-id

## Overview

The `@tryon-technology/global-id` package is a powerful tool for encoding and decoding versionable global identifiers in TypeScript applications. It enables the use of objects as identifiers and supports flexible migration from legacy ID formats to newer ones. The library uses efficient encoding techniques, including compression, to minimize the length of the encoded IDs.

This package is open source, licensed under the MIT License. Contributions are welcomed and appreciated.

## Installation

```bash
npm install @tryon-technology/global-id
```

## Usage

### Basic Setup

Import the necessary classes from the package:

```typescript
import {
  TypeRegistry,
  ParserRegistry,
  Encoder,
  Decoder,
  GlobalId,
  IParser,
} from '@tryon-technology/global-id';
```

### Defining Parsers

Implement parsers for different ID types. For example, a legacy identifier parser for an organization:

```typescript
class OrganizationLegacyIdentifierParser implements IParser {
  parse(value: string): string {
    return value;
  }
}
```

### Register Types and Parsers

Initialize and configure `TypeRegistry` and `ParserRegistry`:

```typescript
const typeRegistry = new TypeRegistry();
const parserRegistry = new ParserRegistry(typeRegistry);

// Register a type with its corresponding prefix
typeRegistry.registerType('Organization', 'org');

// Register a parser for a specific type and version
parserRegistry.registerParser(
  'org',
  'legacy',
  new OrganizationLegacyIdentifierParser()
);
```

### Encoding and Decoding

Create encoder and decoder instances:

```typescript
const encoder = new Encoder(typeRegistry);
const decoder = new Decoder(parserRegistry, typeRegistry);
```

Define functions to encode and decode global IDs:

```typescript
const encode = (id: GlobalId<unknown>): string => {
  return encoder.encode(id);
};

const decode = (id: string): GlobalId<never> => {
  return decoder.decode(id);
};
```

Export these functions for use in other parts of your application:

```typescript
export { encode, decode, GlobalId };
```

### Example Usage

Demonstrating encoding and decoding of a global ID:

```typescript
import { GlobalId, encode, decode } from './id';

describe('id', () => {
  it('should encode and decode global id', () => {
    const legacyId = '____RANDOM____';
    const globalId = new GlobalId('Organization', 'legacy', legacyId);
    const globalIdString = encode(globalId);

    console.log(`Local ID: ${legacyId}, length: ${legacyId.length}`);
    console.log(
      `Global Id: ${globalIdString}, length: ${globalIdString.length}`
    );

    const decodedGlobalId: GlobalId<string> = decode(globalIdString);

    expect(decodedGlobalId).toEqual(globalId);
    expect(decodedGlobalId.getValue()).toEqual(legacyId);
  });
});
```

## Contributing

Contributions to this package are welcome! Please follow standard open-source contribution guidelines, including forking the repository, creating a branch for your contribution, and submitting a pull request for review.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
