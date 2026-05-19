# Design Principles

## Core Principles

1. **Single Source of Truth**: @theme in globals.css is the only authoritative source for design tokens
2. **Type Safety**: All TypeScript interfaces must remain unchanged; no public API modifications
3. **No New Dependencies**: Zero new npm packages; solve problems with existing tools
4. **Progressive Enhancement**: Changes must not break existing functionality
5. **Minimal Diff**: Prefer targeted fixes over broad rewrites

## Architecture Rules

- CSS custom properties defined in @theme generate Tailwind utility classes automatically
- Custom CSS classes must not conflict with Tailwind-generated utility classes
- All color references must use design system tokens (foreground-*, brand-*, background-*, etc.)
- z-index values must follow a defined layer hierarchy
- Layout fixes must preserve responsive behavior across all breakpoints

## File Modification Rules

- globals.css: Primary file for @theme and custom CSS modifications
- Component .tsx files: Only className string modifications, no logic changes
- tailwind.config.mjs: To be deleted (dead file in Tailwind v4)
- No new files to be created (except deletion of dead code)
