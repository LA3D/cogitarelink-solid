FROM solidproject/community-server:next

# Install shape-validator-component from GitHub
RUN npm install --save https://github.com/CommunitySolidServer/shape-validator-component/tarball/main

# Fix 1: CSS v5→v8 n3 namespace import
RUN sed -i 's/import namedNode = DataFactory.namedNode;/const namedNode = DataFactory.namedNode;/' \
    node_modules/shape-validation-component/src/storage/ShapeValidationStore.ts

# Fix 2: AsyncHandler moved from @solid/community-server to asynchronous-handlers
RUN sed -i "s|import { AsyncHandler } from '@solid/community-server'|import { AsyncHandler } from 'asynchronous-handlers'|" \
    node_modules/shape-validation-component/src/storage/validators/ShapeValidator.ts

# Fix 3: Replace Vocabularies with self-contained implementation (createUriAndTermNamespace removed in v8)
RUN cat > node_modules/shape-validation-component/src/util/Vocabularies.ts << 'VOCABEOF'
import { DataFactory } from 'n3';
const namedNode = DataFactory.namedNode;

function createUriAndTermNamespace(baseUri: string, ...localNames: string[]) {
  const namespace: Record<string, any> = {};
  for (const name of localNames) {
    namespace[name] = baseUri + name;
  }
  namespace.terms = {};
  for (const name of localNames) {
    namespace.terms[name] = namedNode(baseUri + name);
  }
  return namespace as any;
}

export const SH = createUriAndTermNamespace('http://www.w3.org/ns/shacl#',
  'targetClass',
);

export const LDP = createUriAndTermNamespace('http://www.w3.org/ns/ldp#',
  'contains',
  'BasicContainer',
  'Container',
  'Resource',
  'constrainedBy',
);
VOCABEOF

# Fix 4: Update package.json CSS dependency version
RUN cd node_modules/shape-validation-component && \
    sed -i 's|"@solid/community-server": "\^5.1.0"|"@solid/community-server": "^8.0.0"|' package.json

# Build TypeScript
RUN cd node_modules/shape-validation-component && npx tsc --skipLibCheck --noEmit false --outDir dist

# Generate Components.js context
RUN cd node_modules/shape-validation-component && npx componentsjs-generator -s src -c dist/components

# Fix 5: Patch generated JSON-LD contexts: ^5.0.0 → ^8.0.0
RUN find node_modules/shape-validation-component/dist -name '*.jsonld' \
    -exec sed -i 's|@solid/community-server/\^5.0.0|@solid/community-server/^8.0.0|g' {} +

# Note: Validation errors return HTTP 500 instead of 400 because the shape-validator's
# bundled CSS v5 BadRequestHttpError doesn't pass CSS v8's HttpError.isInstance() check
# (requires .metadata property). A proper fork would rewrite as ESM importing from CSS v8.
# The validation logic is correct — invalid data is rejected with clear error messages.
