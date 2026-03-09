import { useState, useCallback } from "react";

const C = {
  bg: "#0d1117", card: "#161b22", border: "#30363d", accent: "#58a6ff",
  green: "#3fb950", orange: "#d29922", red: "#f85149", purple: "#bc8cff",
  pink: "#f778ba", cyan: "#39d2c0", yellow: "#e3b341",
  text: "#e6edf3", muted: "#8b949e", dim: "#484f58", codeBg: "#0d1117",
};
const mono = "'SF Mono','Fira Code',Consolas,monospace";
const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";

const Badge = ({ color, children, style }) => (
  <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:12, fontSize:11,
    fontWeight:600, background:`${color}22`, color, border:`1px solid ${color}44`, marginRight:4, ...style }}>
    {children}
  </span>
);
const P = ({ children, style }) => (
  <p style={{ color:C.text, fontSize:13.5, lineHeight:1.7, margin:"0 0 12px", ...style }}>{children}</p>
);
const CodeBlock = ({ children, title, lang }) => (
  <div style={{ background:C.codeBg, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", margin:"8px 0" }}>
    {title && <div style={{ padding:"5px 12px", borderBottom:`1px solid ${C.border}`,
      fontSize:11, color:C.muted, fontFamily:mono, display:"flex", justifyContent:"space-between" }}>
      <span>{title}</span>{lang && <Badge color={C.dim} style={{fontSize:10}}>{lang}</Badge>}
    </div>}
    <pre style={{ margin:0, padding:14, fontFamily:mono, fontSize:12, lineHeight:1.55,
      color:C.text, overflowX:"auto", whiteSpace:"pre" }}>{children}</pre>
  </div>
);
const Card = ({ title, icon, accent, children, style }) => (
  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
    padding:20, borderLeft:`3px solid ${accent||C.accent}`, marginBottom:16, ...style }}>
    {title && <h3 style={{ color:accent||C.accent, fontSize:15, fontWeight:600, margin:"0 0 10px",
      fontFamily:sans }}>{icon} {title}</h3>}
    {children}
  </div>
);
const Section = ({ title, subtitle, children, id }) => (
  <div id={id} style={{ marginBottom:48, scrollMarginTop:80 }}>
    <h2 style={{ color:C.text, fontSize:22, fontWeight:700, margin:"0 0 4px", fontFamily:sans }}>{title}</h2>
    {subtitle && <p style={{ color:C.muted, fontSize:14, margin:"0 0 16px", lineHeight:1.5 }}>{subtitle}</p>}
    {children}
  </div>
);
const Expandable = ({ title, badge, badgeColor, accent, children, defaultOpen }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  const toggle = useCallback(() => setOpen(o => !o), []);
  return (
    <div style={{ background:C.card, border:`1px solid ${open?(accent||C.accent):C.border}`,
      borderRadius:10, overflow:"hidden", marginBottom:10 }}>
      <div onClick={toggle} style={{ padding:"12px 16px", cursor:"pointer",
        display:"flex", alignItems:"center", gap:10,
        borderBottom:open?`1px solid ${C.border}`:"none" }}>
        <span style={{ color:C.muted, fontSize:14, transform:open?"rotate(90deg)":"none",
          transition:"transform 0.2s", lineHeight:1 }}>{"▶"}</span>
        <span style={{ color:C.text, fontWeight:600, fontSize:14, flex:1 }}>{title}</span>
        {badge && <Badge color={badgeColor||C.accent}>{badge}</Badge>}
      </div>
      {open && <div style={{ padding:16 }}>{children}</div>}
    </div>
  );
};
const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display:"flex", gap:2, marginBottom:16, borderBottom:`1px solid ${C.border}`, paddingBottom:0, flexWrap:"wrap" }}>
    {tabs.map(t => (
      <button key={t} onClick={()=>onChange(t)} style={{
        background: active===t ? `${C.accent}15` : "transparent",
        color: active===t ? C.accent : C.muted,
        border:"none", borderBottom: active===t ? `2px solid ${C.accent}` : "2px solid transparent",
        padding:"8px 16px", cursor:"pointer", fontSize:13, fontWeight:active===t?600:400,
        fontFamily:sans, transition:"all 0.15s",
      }}>{t}</button>
    ))}
  </div>
);
const Rec = ({ label, color, children }) => (
  <div style={{ padding:12, background:`${color}0a`, borderRadius:8, border:`1px solid ${color}22`,
    borderLeft:`3px solid ${color}`, margin:"12px 0" }}>
    <span style={{ fontSize:11, fontWeight:700, color, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
    <div style={{ marginTop:6 }}>{children}</div>
  </div>
);

export default function KSCImplementationPlan() {
  const [activeKindTab, setActiveKindTab] = useState("What is Kind<T>?");
  const [activeDependTab, setActiveDependTab] = useState("What to track");
  const [activeNameTab, setActiveNameTab] = useState("What to enforce");
  const [activePipelineTab, setActivePipelineTab] = useState("Option A");

  return (
    <div style={{ background:C.bg, color:C.text, minHeight:"100vh", padding:"40px 20px", fontFamily:sans }}>
      <div style={{ maxWidth:1000, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:48 }}>
          <h1 style={{ color:C.accent, fontSize:32, fontWeight:800, margin:"0 0 8px", fontFamily:sans }}>
            KSC Implementation Plan
          </h1>
          <p style={{ color:C.muted, fontSize:15, margin:0, lineHeight:1.6 }}>
            A comprehensive roadmap for evolving KindScript from config-driven checking to type-level kind wrappers, dependency analysis, and name enforcement.
          </p>
        </div>

        {/* Section 1: Current Architecture */}
        <Section id="section-1" title="Section 1: Current Architecture Overview" subtitle="Understanding the existing Config → Bind → Link → Check pipeline">
          <Card title="🏗️ The Four-Stage Pipeline" accent={C.green}>
            <P>KSC processes source code through four sequential stages, each transforming the input into a richer intermediate representation:</P>
            <CodeBlock title="Pipeline Stages" lang="text">
{`Config → Bind → Link → Check
  ↓      ↓      ↓      ↓
YAML  Symbols Paths Violations`}
            </CodeBlock>
          </Card>

          <Card title="📋 Stage 1: Config (src/config.ts)" accent={C.cyan}>
            <P><Badge color={C.cyan}>defineConfig()</Badge> reads rule configuration:</P>
            <ul style={{ color:C.text, fontSize:13.5, margin:"0 0 12px", paddingLeft:24 }}>
              <li style={{ marginBottom:8 }}><Badge color={C.dim}>RuleSet</Badge> — maps path patterns to property checks</li>
              <li style={{ marginBottom:8 }}><Badge color={C.dim}>TargetEntry</Badge> — file/directory glob with rules</li>
              <li><Badge color={C.dim}>CompositeEntry</Badge> — nested rule composition</li>
            </ul>
          </Card>

          <Card title="🔗 Stage 2: Bind (src/binder.ts)" accent={C.purple}>
            <P><Badge color={C.purple}>ksBind()</Badge> iterates config entries and creates symbols:</P>
            <CodeBlock title="KindSymbol Structure">
{`{
  id: string;           // unique identifier
  name: string;         // symbol name
  declaredProperties: { [key: string]: unknown };
  path: string;         // file path
  valueKind: "function" | "class" | "type" | ...
}`}
            </CodeBlock>
          </Card>

          <Card title="🎯 Stage 3: Link (src/linker.ts)" accent={C.orange}>
            <P><Badge color={C.orange}>ksLink()</Badge> resolves symbol paths to actual source files:</P>
            <ul style={{ color:C.text, fontSize:13.5, margin:"0 0 12px", paddingLeft:24 }}>
              <li style={{ marginBottom:8 }}>Converts KindSymbol paths → ts.SourceFile[]</li>
              <li><Badge color={C.dim}>ResolvedSymbol</Badge> — symbol with resolved file context</li>
            </ul>
          </Card>

          <Card title="✔️ Stage 4: Check (src/checker.ts)" accent={C.green}>
            <P><Badge color={C.green}>createKSChecker()</Badge> uses Property Check Registry pattern:</P>
            <CodeBlock title="Check Pattern">
{`each check: (node, checker) => { ok, violations }

Registered checks:
- noImports
- noConsole
- immutable
- static
- noSideEffects
- noMutation
- noIO
- pure
- maxFanOut`}
            </CodeBlock>
          </Card>

          <Card title="🔄 Current Limitation" accent={C.red}>
            <Rec label="Important" color={C.red}>
              <P>Kinds are config-driven only. No per-declaration granularity — checking happens at file/directory level. The next evolution adds <strong>type-level Kind&lt;T&gt; wrappers</strong> for declaration-specific properties.</P>
            </Rec>
          </Card>
        </Section>

        {/* Section 2: Kind<T> Wrapper */}
        <Section id="section-2" title="Section 2: The Kind&lt;T&gt; Wrapper — Design Decision" subtitle="How to express kinds at the type level">
          <TabBar tabs={["What is Kind<T>?", "Option A: Branded", "Option B: Identity", "Option C: Config-only", "Finding Kinds in AST"]}
            active={activeKindTab} onChange={setActiveKindTab} />

          {activeKindTab === "What is Kind<T>?" && (
            <>
              <P>A <strong>phantom/marker type</strong> that wraps any TypeScript type to declare it as a "kind" with runtime-checkable properties.</P>
              <Card title="User Example" accent={C.pink}>
                <CodeBlock title="user-code.ts" lang="typescript">
{`// Declare a Pure handler kind
type Pure<T> = Kind<T, {
  pure: true,
  noIO: true,
  noSideEffects: true
}>;

// User writes:
const handler: Pure<(req: Request) => Response> = (req) => {
  return new Response(req.body);
};

// KSC finds this usage, sees Kind<...>, extracts props,
// and checks that handler function is indeed pure and has no IO`}
                </CodeBlock>
              </Card>
              <P>This allows <strong>declaration-level granularity</strong>: each variable/function annotated with a specific kind gets its own checklist of properties.</P>
            </>
          )}

          {activeKindTab === "Option A: Branded" && (
            <>
              <Card title="Implementation" accent={C.cyan}>
                <CodeBlock title="types.ts">
{`declare const KindBrand: unique symbol;

type Kind<T, Props extends Record<string, unknown> = {}> =
  T & { [KindBrand]: Props };`}
                </CodeBlock>
              </Card>
              <Card title="✅ Advantages" accent={C.green}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>Works with existing TS type system — no custom parsing needed</li>
                  <li style={{ marginBottom:8 }}>TypeScript checker still validates the T part</li>
                  <li>Brand is phantom, no runtime overhead</li>
                </ul>
              </Card>
              <Card title="❌ Disadvantages" accent={C.red}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li>Brand is phantom at runtime (TS erases it) — KSC must extract Props from type args using TS parser</li>
                  <li>Requires understanding TS type alias resolution</li>
                </ul>
              </Card>
            </>
          )}

          {activeKindTab === "Option B: Identity" && (
            <>
              <Card title="Implementation" accent={C.cyan}>
                <CodeBlock title="types.ts">
{`type Kind<T, Props = {}> = T; // Identity at type level
// KSC extracts Props from Kind<T, Props> usage sites via AST parsing`}
                </CodeBlock>
              </Card>
              <Card title="✅ Advantages" accent={C.green}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>Zero runtime overhead — Kind erases completely</li>
                  <li>Simplest possible definition</li>
                  <li>TypeScript type checker has nothing to do — T is validated normally</li>
                </ul>
              </Card>
              <Card title="❌ Disadvantages" accent={C.red}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li>TS erases kind completely — KSC must manually parse type arguments from AST</li>
                  <li>Type errors inside the Props object will not be caught by TS</li>
                </ul>
              </Card>
            </>
          )}

          {activeKindTab === "Option C: Config-only" && (
            <>
              <Card title="No Type-Level Wrapper" accent={C.dim}>
                <P>Keep the current approach: kinds are defined exclusively in config files, no type-level annotation.</P>
              </Card>
              <Card title="✅ Advantages" accent={C.green}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>Simplest — already works, no type system changes</li>
                  <li>Familiar YAML/JSON configuration</li>
                </ul>
              </Card>
              <Card title="❌ Disadvantages" accent={C.red}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>No per-declaration granularity</li>
                  <li style={{ marginBottom:8 }}>Checking only at file/directory level</li>
                  <li>Users can't declare kinds alongside their types</li>
                </ul>
              </Card>
            </>
          )}

          {activeKindTab === "Finding Kinds in AST" && (
            <>
              <Card title="Strategy: Walk and Extract" accent={C.cyan}>
                <P>After TypeScript binding, walk source files looking for type references to <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>Kind</code>:</P>
                <CodeBlock title="kind-finder.ts pseudocode">
{`function findKindsInProgram(program: ts.Program) {
  const kindMap = new WeakMap<ts.Symbol, KindProps>();

  program.getSourceFiles().forEach(file => {
    ts.forEachChild(file, function visit(node) {
      // Look for: const x: Kind<T, Props> = ...
      if (ts.isTypeReferenceNode(node)) {
        const typeName = node.typeName;
        const resolved = checker.getTypeFromTypeNode(node);

        if (isKindType(resolved)) {
          const [T, Props] = extractTypeArgs(node, checker);
          // Map the symbol of 'x' to Props
          recordKind(kindMap, T, Props);
        }
      }
      visit(node);
    });
  });

  return kindMap;
}`}
                </CodeBlock>
              </Card>
              <Card title="Key API Calls" accent={C.purple}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}><Badge color={C.purple}>ts.isTypeReferenceNode()</Badge> — check if node is {"Type<Args>"}</li>
                  <li style={{ marginBottom:8 }}><Badge color={C.purple}>ts.TypeChecker.getTypeFromTypeNode()</Badge> — get actual type object</li>
                  <li style={{ marginBottom:8 }}><Badge color={C.purple}>ts.TypeChecker.getSymbolAtLocation()</Badge> — resolve name to symbol</li>
                  <li><Badge color={C.purple}>node.typeArguments</Badge> — extract Props from {"Kind<T, Props>"}</li>
                </ul>
              </Card>
            </>
          )}

          <Card title="🎯 Recommendation: Option B (Identity)" accent={C.accent}>
            <Rec label="Chosen" color={C.accent}>
              <P>Go with the identity type <strong>type Kind&lt;T, Props&gt; = T</strong>. KSC extracts Props from usage sites in the AST. This is least intrusive, lets TS checker handle T normally, and KSC handles Props extraction via a new kind-finder module.</P>
            </Rec>
          </Card>
        </Section>

        {/* Section 3: Dependency Analysis */}
        <Section id="section-3" title="Section 3: Dependency Analysis — Design Decision" subtitle="Tracking which modules and symbols a kind depends on">
          <TabBar tabs={["What to track", "Dependency Graph", "Constraints & Patterns", "Symbol-level", "Recommendation"]}
            active={activeDependTab} onChange={setActiveDependTab} />

          {activeDependTab === "What to track" && (
            <>
              <Card title="Three Levels of Dependency" accent={C.cyan}>
                <P><strong>Module-level:</strong> Which modules does this file import?</P>
                <P><strong>Export-level:</strong> Which specific exported symbols are used?</P>
                <P><strong>Call-level:</strong> Which functions/types are actually referenced in the kind's body?</P>
              </Card>
              <Card title="Example" accent={C.pink}>
                <CodeBlock title="handler.ts">
{`// Module imports
// bring in UserService from '@/domain/user'
// bring in OrderService from '@/domain/order'
// bring in logger from '@/infrastructure/logger'

type SafeHandler = Kind<Handler, {
  dependsOn: ['@/domain/user', '@/domain/order'],
  doesntDependOn: ['@/infrastructure/*'],
  optionallyDependsOn: ['@/utils/logger'],
}>;

const handle: SafeHandler = (req) => {
  // Inferred: actually uses UserService and OrderService
  // Violation: uses logger (infrastructure layer)
  const user = UserService.find(req.id);
  logger.info('Request:', req);
  return OrderService.create(user);
};`}
                </CodeBlock>
              </Card>
            </>
          )}

          {activeDependTab === "Dependency Graph" && (
            <>
              <Card title="Construction Strategy" accent={C.cyan}>
                <CodeBlock title="Graph Building Steps">
{`1. Walk each source file in program.getSourceFiles()
2. Collect all ImportDeclaration nodes
3. For each import, resolve via ts.resolveModuleName()
4. Build adjacency list: Map<filePath, Set<filePath>>

Example:
  src/handlers/user.ts imports:
    - '@/domain/user' → resolves to src/domain/user.ts
    - '@/utils/logger' → resolves to src/utils/logger.ts

  Graph entry:
    'src/handlers/user.ts' → Set {
      'src/domain/user.ts',
      'src/utils/logger.ts'
    }`}
                </CodeBlock>
              </Card>
              <Card title="Function-Level Tracking" accent={C.purple}>
                <P>For more precision, track which imports a specific function body references:</P>
                <CodeBlock title="Function-body Analysis">
{`function trackFunctionDependencies(func: FunctionDeclaration) {
  const deps = new Set<string>();

  // Walk the function body
  // Look for Identifier nodes
  // Resolve each identifier to its declaration
  // If it's from an import, record that module
  // Add to deps

  return deps;
}`}
                </CodeBlock>
              </Card>
            </>
          )}

          {activeDependTab === "Constraints & Patterns" && (
            <>
              <Card title="Three Constraint Types" accent={C.cyan}>
                <CodeBlock title="Kind Property Definition">
{`type Handler = Kind<HandlerFn, {
  // MUST depend on ALL of these
  dependsOn: ['@/domain/user', '@/domain/order'],

  // MUST NOT depend on ANY of these (glob patterns allowed)
  doesntDependOn: ['@/infrastructure/*', '@/external/**'],

  // MAY depend on these (soft constraint, informational)
  optionallyDependsOn: ['@/utils/logger'],
}>;`}
                </CodeBlock>
              </Card>
              <Card title="Constraint Semantics" accent={C.orange}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}><Badge color={C.orange}>dependsOn</Badge> — inferred set must cover all listed modules (MUST)</li>
                  <li style={{ marginBottom:8 }}><Badge color={C.orange}>doesntDependOn</Badge> — inferred set must not intersect (MUST NOT)</li>
                  <li><Badge color={C.orange}>optionallyDependsOn</Badge> — informational, no violation if used (SOFT)</li>
                </ul>
              </Card>
              <Card title="Glob Pattern Examples" accent={C.pink}>
                <CodeBlock title="Pattern Matching">
{`doesntDependOn: [
  '@/infrastructure/*',           // Matches @/infrastructure/db, @/infrastructure/cache
  '@/external/**',                // Matches @/external/foo, @/external/foo/bar, etc
  '!node_modules',                // Can use negation if needed
  '/\.deprecated\./i',            // Regex-style (if supported)
]`}
                </CodeBlock>
              </Card>
            </>
          )}

          {activeDependTab === "Symbol-level" && (
            <>
              <Card title="More Precise: Track Specific Exports" accent={C.cyan}>
                <P>Instead of just file paths, track which specific exported symbols are used:</P>
                <CodeBlock title="Symbol-Level Tracking">
{`type PureHandler = Kind<HandlerFn, {
  // Can only use these specific exports
  depends OnExports: {
    '@/domain/user': ['User', 'UserService'],
    '@/domain/order': ['Order'],
  },

  // Cannot use these exports
  doesntDependOnExports: {
    '@/infrastructure/*': ['*'],  // Cannot use anything from infra
  },
}>;`}
                </CodeBlock>
              </Card>
              <Card title="⚠️ Complexity Warning" accent={C.red}>
                <Rec label="Warning" color={C.red}>
                  <P>Symbol-level tracking requires full TS type checker resolution. This is accurate but expensive. <strong>Recommended for Phase 2 or later</strong>, after file-level tracking is solid.</P>
                </Rec>
              </Card>
            </>
          )}

          {activeDependTab === "Recommendation" && (
            <>
              <Card title="🎯 Recommendation: File-Level First (Option A)" accent={C.accent}>
                <Rec label="Phase 1" color={C.accent}>
                  <P><strong>Implement file-level dependency tracking:</strong> track which files a kind imports, not which specific exports. This matches the current checker architecture (file-based) and delivers 80% of the value with 20% of the complexity.</P>
                  <P style={{marginTop:12}}>Later phases can expand to symbol-level tracking once the architecture is proven.</P>
                </Rec>
              </Card>
            </>
          )}
        </Section>

        {/* Section 4: Name Analysis */}
        <Section id="section-4" title="Section 4: Name Analysis — Design Decision" subtitle="Enforcing naming conventions per kind">
          <TabBar tabs={["What to enforce", "Implementation", "Pattern Syntax", "Recommendation"]}
            active={activeNameTab} onChange={setActiveNameTab} />

          {activeNameTab === "What to enforce" && (
            <>
              <Card title="Naming Patterns at a Glance" accent={C.cyan}>
                <P><strong>Functions:</strong> Enforce patterns like <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>*Decider</code>, <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>handle*</code>, <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>create*</code></P>
                <P><strong>Classes:</strong> Enforce <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>*Service</code>, <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>*Repository</code>, etc.</P>
                <P><strong>Variables:</strong> Enforce <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>is*</code> for booleans, <code style={{color:C.accent, background:C.codeBg, padding:"2px 6px", borderRadius:4}}>get*</code> for getters (later)</P>
              </Card>
              <Card title="Example: Handler Naming" accent={C.pink}>
                <CodeBlock title="kind-declarations.ts">
{`type SafeHandler = Kind<Handler, {
  name: { matches: '*Handler' },
}>;

// ✅ OK
const checkoutHandler: SafeHandler = ...;
const logoutHandler: SafeHandler = ...;

// ❌ Violation: 'checkout' doesn't match '*Handler'
const checkout: SafeHandler = ...;`}
                </CodeBlock>
              </Card>
            </>
          )}

          {activeNameTab === "Implementation" && (
            <>
              <Card title="AST Walk + Name Extraction" accent={C.cyan}>
                <CodeBlock title="name-checker.ts pseudocode">
{`function checkNamingProperty(
  node: ts.Declaration,
  nameSpec: { matches: string | RegExp },
  checker: KSChecker
) {
  const name = extractIdentifier(node);

  if (!name) return { ok: true }; // No name to check

  const matches = patternMatches(name, nameSpec.matches);

  if (!matches) {
    return {
      ok: false,
      violations: [{
        message: \`Name '\${name}' does not match pattern '\${nameSpec.matches}'\`,
        node,
      }],
    };
  }

  return { ok: true };
}

function extractIdentifier(node: ts.Declaration): string | null {
  if (ts.isFunctionDeclaration(node)) return node.name?.text;
  if (ts.isClassDeclaration(node)) return node.name?.text;
  if (ts.isVariableDeclaration(node)) return node.name?.getText();
  return null;
}`}
                </CodeBlock>
              </Card>
            </>
          )}

          {activeNameTab === "Pattern Syntax" && (
            <>
              <Card title="Option A: Glob Patterns" accent={C.cyan}>
                <CodeBlock title="Glob Approach">
{`name: { matches: '*Decider' }     // ends with Decider
name: { matches: 'handle*' }        // starts with handle
name: { matches: '*Handler*' }      // contains Handler
name: { matches: '[gs]et*' }        // starts with 'get' or 'set'`}
                </CodeBlock>
                <P style={{marginTop:12}}><Badge color={C.green}>Pro:</Badge> Simple, familiar from file globbing</P>
                <P><Badge color={C.red}>Con:</Badge> Limited expressiveness</P>
              </Card>

              <Card title="Option B: Regex Patterns" accent={C.purple}>
                <CodeBlock title="Regex Approach">
{`name: { matches: /^handle[A-Z]/ }      // handleX...
name: { matches: /Decider$/ }           // ...Decider
name: { matches: /^(create|make|new)/ } // factory pattern`}
                </CodeBlock>
                <P style={{marginTop:12}}><Badge color={C.green}>Pro:</Badge> Powerful, standard JS syntax</P>
                <P><Badge color={C.red}>Con:</Badge> Steeper learning curve for simple cases</P>
              </Card>

              <Card title="Option C: Hybrid (Recommended)" accent={C.accent}>
                <CodeBlock title="Best of Both">
{`// Glob by default (simple)
name: { matches: '*Handler' }

// Regex with /.../ delimiters
name: { matches: '/^handle[A-Z]/' }

// Parser:
function compilePattern(spec: string): (name: string) => boolean {
  if (spec.startsWith('/') && spec.endsWith('/')) {
    const regex = new RegExp(spec.slice(1, -1));
    return (name) => regex.test(name);
  }
  // Convert glob to regex
  return globToRegex(spec);
}`}
                </CodeBlock>
              </Card>
            </>
          )}

          {activeNameTab === "Recommendation" && (
            <>
              <Card title="🎯 Recommendation: Hybrid (Option C)" accent={C.accent}>
                <Rec label="Chosen" color={C.accent}>
                  <P>Use <strong>glob patterns by default</strong> with <strong>regex as escape hatch</strong>. This gives 90% of users the simplicity they want (*Handler, handle*) while letting power users write regex for complex rules.</P>
                </Rec>
              </Card>
            </>
          )}
        </Section>

        {/* Section 5: Pipeline Ordering */}
        <Section id="section-5" title="Section 5: Pipeline Ordering — Design Decision" subtitle="When to resolve types and check properties">
          <TabBar tabs={["Option A: TS First", "Option B: KSC Pre→TS→Post", "Option C: Demand-Driven", "Recommendation"]}
            active={activePipelineTab} onChange={setActivePipelineTab} />

          {activePipelineTab === "Option A: TS First" && (
            <>
              <Card title="Architecture" accent={C.cyan}>
                <CodeBlock title="Pipeline Order">
{`Source Files
    ↓
ts.parse (Syntax tree)
    ↓
ts.bind (Symbol resolution)
    ↓
ts.check (Type checking)
    ↓
ksc.findKinds (Find Kind<T> usages)
    ↓
ksc.check (Check properties)`}
                </CodeBlock>
              </Card>
              <Card title="✅ Advantages" accent={C.green}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>KSC has full type information available</li>
                  <li style={{ marginBottom:8 }}>Can leverage ts.TypeChecker for resolving Kind type args</li>
                  <li>Simpler — one TS pass, one KSC pass</li>
                </ul>
              </Card>
              <Card title="❌ Disadvantages" accent={C.red}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>Cannot report KSC errors if TS has errors</li>
                  <li>User must fix TS errors before seeing KSC violations</li>
                  <li>Type checking is expensive; may be overkill for syntax-level checks</li>
                </ul>
              </Card>
            </>
          )}

          {activePipelineTab === "Option B: KSC Pre→TS→Post" && (
            <>
              <Card title="Architecture" accent={C.purple}>
                <CodeBlock title="Multi-Pass Pipeline">
{`Source Files
    ↓
ts.parse
    ↓
ts.bind
    ↓
ksc.preCheck (Syntax-level: names, structure)
    ↓
ts.check (Type checking)
    ↓
ksc.postCheck (Type-level: dependencies, purity)`}
                </CodeBlock>
              </Card>
              <Card title="✅ Advantages" accent={C.green}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>Pre-check catches errors even if TS has errors</li>
                  <li style={{ marginBottom:8 }}>Pre-check is fast (no type resolution)</li>
                  <li>Can report quick wins before expensive TS check</li>
                </ul>
              </Card>
              <Card title="❌ Disadvantages" accent={C.red}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>Two KSC passes — more complex orchestration</li>
                  <li style={{ marginBottom:8 }}>State must be maintained between pre and post</li>
                  <li>Harder to debug which check runs when</li>
                </ul>
              </Card>
            </>
          )}

          {activePipelineTab === "Option C: Demand-Driven" && (
            <>
              <Card title="Architecture (Recommended)" accent={C.cyan}>
                <CodeBlock title="Lazy Evaluation Pipeline">
{`Source Files
    ↓
ts.parse
    ↓
ts.bind
    ↓
ksc.findKinds (Find Kind<T> usages in symbol table)
    ↓
for each check:
  if check.needsTypeInfo:
    ts.check (create TypeChecker if needed)
  run check`}
                </CodeBlock>
              </Card>
              <Card title="How It Works" accent={C.cyan}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}><Badge color={C.cyan}>nameCheck</Badge> — runs without types (syntax only)</li>
                  <li style={{ marginBottom:8 }}><Badge color={C.cyan}>dependencyCheck</Badge> — runs without types (import resolution only)</li>
                  <li style={{ marginBottom:8 }}><Badge color={C.cyan}>purityCheck</Badge> — triggers lazy type checker creation</li>
                </ul>
              </Card>
              <Card title="✅ Advantages" accent={C.green}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li style={{ marginBottom:8 }}>Aligns with existing lazy pattern (checker is already lazy in program.ts)</li>
                  <li style={{ marginBottom:8 }}>Only pay cost of type checking if needed</li>
                  <li style={{ marginBottom:8 }}>Reports syntax/naming errors immediately</li>
                  <li>Each check declares its dependencies transparently</li>
                </ul>
              </Card>
              <Card title="❌ Disadvantages" accent={C.red}>
                <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
                  <li>Requires metadata on each check (needsTypeInfo flag)</li>
                  <li>More complex check registration</li>
                </ul>
              </Card>
            </>
          )}

          {activePipelineTab === "Recommendation" && (
            <>
              <Card title="🎯 Recommendation: Demand-Driven (Option C)" accent={C.accent}>
                <Rec label="Chosen" color={C.accent}>
                  <P><strong>Extend the existing lazy pattern.</strong> Each check declares whether it needs type information. Name checks and dependency checks run immediately (no TS checker). Purity checks trigger type checker creation on demand. This fits the existing architecture and minimizes unnecessary type work.</P>
                </Rec>
              </Card>
            </>
          )}
        </Section>

        {/* Section 6: Roadmap */}
        <Section id="section-6" title="Section 6: Implementation Roadmap" subtitle="Four phases to evolve KSC">
          <Card title="📅 Phase 1: Kind<T> Discovery (Weeks 1-2)" accent={C.green}>
            <P><strong>Deliverable:</strong> Users can write {"Kind<T>"} in their code; KSC finds and records them.</P>
            <ul style={{ color:C.text, fontSize:13.5, margin:"0 0 12px", paddingLeft:24 }}>
              <li style={{ marginBottom:8 }}>Create src/kind-finder.ts — walk AST for Kind usage</li>
              <li style={{ marginBottom:8 }}>Modify src/binder.ts to call kind-finder and merge results</li>
              <li style={{ marginBottom:8 }}>Extend types.ts with {"Kind<T>"} definition and KindProps interface</li>
              <li>Add tests: verify {"Kind<T>"} discovery in various contexts</li>
            </ul>
          </Card>

          <Card title="📅 Phase 2: Dependency Analysis (Weeks 3-4)" accent={C.orange}>
            <P><strong>Deliverable:</strong> Check dependsOn, doesntDependOn, optionallyDependsOn constraints.</P>
            <ul style={{ color:C.text, fontSize:13.5, margin:"0 0 12px", paddingLeft:24 }}>
              <li style={{ marginBottom:8 }}>Extend PropertySpec in types.ts with dependency constraints</li>
              <li style={{ marginBottom:8 }}>Implement module-level dependency graph in src/checker.ts</li>
              <li style={{ marginBottom:8 }}>Add glob-pattern matching utility (minimatch or similar)</li>
              <li>Register new checks: checkDependencies, checkNoForbiddenDeps</li>
            </ul>
          </Card>

          <Card title="📅 Phase 3: Name Analysis (Weeks 5-6)" accent={C.purple}>
            <P><strong>Deliverable:</strong> Enforce naming conventions on functions, classes, variables.</P>
            <ul style={{ color:C.text, fontSize:13.5, margin:"0 0 12px", paddingLeft:24 }}>
              <li style={{ marginBottom:8 }}>Extend PropertySpec with name constraints</li>
              <li style={{ marginBottom:8 }}>Implement pattern-matching (glob to regex converter)</li>
              <li style={{ marginBottom:8 }}>Create src/name-checker.ts or extend src/checker.ts</li>
              <li>Register new check: checkNamingConvention</li>
            </ul>
          </Card>

          <Card title="📅 Phase 4: Pipeline Refinement & Performance (Weeks 7-8)" accent={C.cyan}>
            <P><strong>Deliverable:</strong> Demand-driven type checking; performance optimization.</P>
            <ul style={{ color:C.text, fontSize:13.5, margin:"0 0 12px", paddingLeft:24 }}>
              <li style={{ marginBottom:8 }}>Add needsTypeInfo metadata to all checks</li>
              <li style={{ marginBottom:8 }}>Modify src/program.ts to gate ts.TypeChecker creation</li>
              <li style={{ marginBottom:8 }}>Benchmarking: measure time savings vs. current approach</li>
              <li>Documentation & examples</li>
            </ul>
          </Card>

          <Card title="🚀 Post-MVP Opportunities" accent={C.pink}>
            <ul style={{ color:C.text, fontSize:13.5, margin:0, paddingLeft:24 }}>
              <li style={{ marginBottom:8 }}>Symbol-level dependency tracking (Phase 2+)</li>
              <li style={{ marginBottom:8 }}>Class method naming (Phase 3+)</li>
              <li style={{ marginBottom:8 }}>Variable naming (bool is*, getters, etc.)</li>
              <li style={{ marginBottom:8 }}>Return type analysis (what does a function return?)</li>
              <li>Integrations: ESLint plugin, VS Code extension</li>
            </ul>
          </Card>
        </Section>

        {/* Section 7: Code Changes Map */}
        <Section id="section-7" title="Section 7: Code Changes Map" subtitle="Exactly which files change and what changes">
          <Card title="📂 File-by-File Breakdown" accent={C.cyan}>
            <Expandable title="src/types.ts" badge="EXTEND" badgeColor={C.orange} defaultOpen>
              <CodeBlock title="Add Kind type definition">
{`// Add Kind identity type
type Kind<T, Props = {}> = T;

// Extend PropertySpec interface
interface PropertySpec {
  // existing
  noImports?: boolean;
  noConsole?: boolean;
  // ... etc

  // new
  dependsOn?: string[];
  doesntDependOn?: string[];
  optionallyDependsOn?: string[];
  name?: { matches: string | RegExp };
}

// Add KindProps interface
interface KindProps {
  [key: string]: unknown;
  dependsOn?: string[];
  doesntDependOn?: string[];
  optionallyDependsOn?: string[];
  name?: { matches: string | RegExp };
}

// Extend KindSymbol (or create KindDeclaration)
interface KindDeclaration {
  symbol: ts.Symbol;
  props: KindProps;
  node: ts.Declaration;
  sourceFile: ts.SourceFile;
}`}
              </CodeBlock>
            </Expandable>

            <Expandable title="src/config.ts" badge="EXTEND" badgeColor={C.orange}>
              <CodeBlock title="Extend RuleSet">
{`// Extend RuleSet type
interface RuleSet {
  // existing
  noImports?: boolean;

  // new
  dependencies?: {
    dependsOn?: string[];
    doesntDependOn?: string[];
    optionallyDependsOn?: string[];
  };
  naming?: {
    matches?: string | RegExp;
  };
}`}
              </CodeBlock>
            </Expandable>

            <Expandable title="src/binder.ts" badge="MODIFY" badgeColor={C.orange}>
              <CodeBlock title="Call kind-finder after binding">
{`// Existing: ksBind creates config-driven symbols
function ksBind(config, sourceFiles): KindSymbol[] {
  // ... existing code ...

  // NEW: Find type-level Kind<T> declarations
  const kindMap = findKindsInProgram(program);

  // Merge with config-driven symbols
  // Update symbol table with extracted props

  return symbols;
}`}
              </CodeBlock>
            </Expandable>

            <Expandable title="src/kind-finder.ts" badge="NEW" badgeColor={C.green} defaultOpen>
              <CodeBlock title="New module to discover Kind<T> usage">
{`// NEW FILE — kind-finder.ts
function findKindsInProgram(
  program: ts.Program
): Map<ts.Symbol, KindProps> {
  const kindMap = new Map<ts.Symbol, KindProps>();
  const checker = program.getTypeChecker();

  // Walk all source files
  // Find Kind<T, Props> type references
  // Extract T and Props
  // Build kindMap

  return kindMap;
}

// Helper: resolve kind property object
function extractKindProps(
  propsNode: ts.TypeLiteralNode,
  checker: ts.TypeChecker
): KindProps {
  // Walk property signatures
  // Build KindProps object
}

// Helper: is this type 'Kind'?
function isKindType(type: ts.Type): boolean {
  // Check if type is Kind or alias to Kind
}`}
              </CodeBlock>
            </Expandable>

            <Expandable title="src/linker.ts" badge="MINOR" badgeColor={C.dim}>
              <P>No major changes needed. The kind-finder output should integrate seamlessly with existing ResolvedSymbol structure.</P>
            </Expandable>

            <Expandable title="src/checker.ts" badge="EXTEND" badgeColor={C.orange} defaultOpen>
              <CodeBlock title="Add dependency and name checks">
{`// Existing: Property Check Registry
const checks = {
  noImports: (node, checker) => { ... },
  noConsole: (node, checker) => { ... },
  // ... existing 9 checks ...

  // NEW CHECKS
  checkDependencies: {
    needsTypeInfo: false,  // Can work with import resolution only
    fn: (node, checker) => {
      // Verify dependsOn, doesntDependOn, optionallyDependsOn
      // using module-level dependency graph
    }
  },

  checkNaming: {
    needsTypeInfo: false,
    fn: (node, checker) => {
      // Extract identifier, match against pattern
    }
  },
};

// Helper functions
function buildDependencyGraph(sourceFile: ts.SourceFile): Map<string, Set<string>> {
  // Walk imports, build adjacency list
}

function matchPattern(name: string, pattern: string | RegExp): boolean {
  // Glob or regex matching
}`}
              </CodeBlock>
            </Expandable>

            <Expandable title="src/program.ts" badge="MODIFY" badgeColor={C.orange}>
              <CodeBlock title="Wire in kind-finder and demand-driven checks">
{`// Existing: createProgram
function createProgram(configPath: string): KSProgram {
  const program = ts.createProgram(...);
  const symbols = ksBind(config, sourceFiles);

  // NEW: find type-level kinds
  const kindMap = findKindsInProgram(program);

  const resolved = ksLink(symbols);

  // Later: on-demand type checker
  let typeChecker: ts.TypeChecker | null = null;
  let lazyGetTypeChecker = () => {
    if (!typeChecker) {
      typeChecker = program.getTypeChecker();
    }
    return typeChecker;
  };

  return {
    // ... existing fields ...
    // Add kindMap to KSProgram interface
    getKindMap: () => kindMap,
  };
}`}
              </CodeBlock>
            </Expandable>

            <Expandable title="src/cli.ts" badge="NO_CHANGE" badgeColor={C.dim}>
              <P>No changes needed. The CLI already discovers config, creates program, and outputs diagnostics. The new checks will automatically be included via the Property Check Registry.</P>
            </Expandable>

            <Expandable title="src/index.ts" badge="EXTEND" badgeColor={C.orange}>
              <CodeBlock title="Export new types">
{`// Add new public types from types.ts
// Kind, KindProps, KindDeclaration

// Add kind-finder to public API
// findKindsInProgram`}
              </CodeBlock>
            </Expandable>
          </Card>

          <Card title="🔗 Summary: Impact & Effort" accent={C.accent}>
            <table style={{ width:"100%", borderCollapse:"collapse", color:C.text, fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  <th style={{ textAlign:"left", padding:8 }}>File</th>
                  <th style={{ textAlign:"center", padding:8 }}>Impact</th>
                  <th style={{ textAlign:"center", padding:8 }}>Effort</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:8 }}>types.ts</td>
                  <td style={{ textAlign:"center", padding:8 }}><Badge color={C.orange}>EXTEND</Badge></td>
                  <td style={{ textAlign:"center", padding:8 }}>Low</td>
                </tr>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:8 }}>config.ts</td>
                  <td style={{ textAlign:"center", padding:8 }}><Badge color={C.orange}>EXTEND</Badge></td>
                  <td style={{ textAlign:"center", padding:8 }}>Low</td>
                </tr>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:8 }}>binder.ts</td>
                  <td style={{ textAlign:"center", padding:8 }}><Badge color={C.orange}>MODIFY</Badge></td>
                  <td style={{ textAlign:"center", padding:8 }}>Medium</td>
                </tr>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:8 }}>kind-finder.ts</td>
                  <td style={{ textAlign:"center", padding:8 }}><Badge color={C.green}>NEW</Badge></td>
                  <td style={{ textAlign:"center", padding:8 }}>Medium</td>
                </tr>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:8 }}>checker.ts</td>
                  <td style={{ textAlign:"center", padding:8 }}><Badge color={C.orange}>EXTEND</Badge></td>
                  <td style={{ textAlign:"center", padding:8 }}>Medium</td>
                </tr>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:8 }}>program.ts</td>
                  <td style={{ textAlign:"center", padding:8 }}><Badge color={C.orange}>MODIFY</Badge></td>
                  <td style={{ textAlign:"center", padding:8 }}>Low</td>
                </tr>
                <tr>
                  <td style={{ padding:8 }}>index.ts</td>
                  <td style={{ textAlign:"center", padding:8 }}><Badge color={C.orange}>EXTEND</Badge></td>
                  <td style={{ textAlign:"center", padding:8 }}>Low</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </Section>

        {/* Footer */}
        <div style={{ marginTop:64, paddingTop:32, borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
          <P style={{ color:C.muted, fontSize:12 }}>
            KindScript (KSC) Implementation Plan — Type-Level Kinds, Dependency Analysis & Name Enforcement
          </P>
          <P style={{ color:C.muted, fontSize:12, margin:0 }}>
            Generated for internal planning. See ~/dev/ksc for existing codebase.
          </P>
        </div>

      </div>
    </div>
  );
}