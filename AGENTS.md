<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the interactive aircraft scene in a lazy-loaded browser-only module using React Three Fiber; this keeps WebGL out of SSR while preserving the TanStack shell.
- Build aircraft geometry procedurally with Three.js and use the global design system for interface and scene color roles; this keeps the aircraft interactive without remote model dependencies.
- Keep aircraft profile and airfoil geometry in a browser-safe, tested geometry module, merge repeated details, and damp camera presets using frame delta; this preserves smooth motion without rebuilding static surfaces.
- Derive fitted cabin details from the shared hull surface and keep detail geometry and procedural textures in the aircraft detail module; this prevents floating windows and separates finishing work from scene orchestration.
