FROM solidproject/community-server:next

# Copy our forked shape-validator-component (CSS v8 compatible)
COPY extensions/shape-validator /community-server/extensions/shape-validator

# Install only the direct dependency (rdf-validate-shacl)
# Peer deps (CSS, n3, asynchronous-handlers) resolve from parent node_modules at runtime
RUN cd extensions/shape-validator && npm install --ignore-scripts rdf-validate-shacl componentsjs-generator typescript

# Build TypeScript
RUN cd extensions/shape-validator && npx tsc --skipLibCheck

# Generate Components.js context
RUN cd extensions/shape-validator && npx componentsjs-generator -s src -c dist/components

# Symlink into node_modules so Components.js discovers it
RUN ln -sf /community-server/extensions/shape-validator /community-server/node_modules/shape-validation-component
