FROM solidproject/community-server:next

# ============================================================================
# shape-validator-component — SHACL validation on write per container
# ============================================================================

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

# ============================================================================
# markdown-rdfa — custom markdown→HTML converter with wikilink resolution
#
# Replaces the default MarkdownToHtmlConverter. The converter class is a CJS
# wrapper (dist-cjs/converter.cjs) that lazy-loads the ESM render pipeline
# (dist/render.js) via dynamic import(). Components.js metadata is hand-
# written under dist-cjs/ — we intentionally skip componentsjs-generator
# because it can't parse dynamic import expressions correctly.
# ============================================================================

COPY extensions/markdown-rdfa /community-server/extensions/markdown-rdfa

# Install runtime deps for the ESM rendering pipeline (unified/remark/rehype)
# plus build-time typescript. @solid/community-server is installed as a
# devDependency so tsc can type-check against its declarations.
RUN cd extensions/markdown-rdfa && npm install --ignore-scripts

# Build both ESM pipeline (src/ → dist/) and CJS wrapper (src-cjs/ → dist-cjs/)
RUN cd extensions/markdown-rdfa && npm run build

# CRITICAL: replace the extension's @solid/community-server copy with a
# symlink to the host CSS. We need it at build time for type checking, but at
# runtime Node must resolve @solid/community-server to the SAME file CSS
# itself uses, so that the classes our converter imports (especially
# RepresentationMetadata and BasicRepresentation) have the same identity as
# the classes CSS passes through its pipeline. Two separate copies → two
# separate class definitions → isRepresentationMetadata(...) returns false
# inside BasicRepresentation's constructor → falls into the wrong branch →
# "premature close" on the response pipe.
RUN rm -rf /community-server/extensions/markdown-rdfa/node_modules/@solid/community-server && \
    ln -sf /community-server /community-server/extensions/markdown-rdfa/node_modules/@solid/community-server

# Symlink into node_modules so Components.js require('markdown-rdfa') resolves
RUN ln -sf /community-server/extensions/markdown-rdfa /community-server/node_modules/markdown-rdfa
