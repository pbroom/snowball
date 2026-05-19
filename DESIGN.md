---
name: Snowball
description: A compact ReBAC task workbench for modeling access graphs and permission explanations.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.148 0.004 228.8)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.148 0.004 228.8)"
  primary: "oklch(0.508 0.118 165.612)"
  primary-foreground: "oklch(0.979 0.021 166.113)"
  secondary: "oklch(0.967 0.001 286.375)"
  secondary-foreground: "oklch(0.21 0.006 285.885)"
  muted: "oklch(0.963 0.002 197.1)"
  muted-foreground: "oklch(0.56 0.021 213.5)"
  accent: "oklch(0.963 0.002 197.1)"
  accent-foreground: "oklch(0.218 0.008 223.9)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.925 0.005 214.3)"
  input: "oklch(0.925 0.005 214.3)"
  ring: "oklch(0.723 0.014 214.4)"
typography:
  display:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "calc(0.625rem * 0.6)"
  md: "calc(0.625rem * 0.8)"
  lg: "0.625rem"
  xl: "calc(0.625rem * 1.4)"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "1.75rem"
    padding: "0 0.5rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "1.75rem"
    padding: "0 0.5rem"
  input-default:
    backgroundColor: "{colors.input}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "1.75rem"
    padding: "0.125rem 0.5rem"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "1rem"
---

# Design System: Snowball

## 1. Overview

**Creative North Star: "The Authorization Field Notebook"**

Snowball should feel like a precise field notebook for access modeling: compact, gridded, and quietly analytical. The interface supports dense scenario editing, actor switching, permission explanation, validation, and audit history without adding theatrical decoration or marketing posture.

The system is product-first. It favors crisp controls, subtle tonal layers, readable labels, and small interactive affordances that let users trace causality across users, orgs, tasks, resources, and relationships.

It explicitly rejects the PRODUCT.md anti-references: generic SaaS landing-page polish, decorative glassmorphism, neon cyber-security tropes, vague AI-dashboard styling, and heavy enterprise admin chrome.

**Key Characteristics:**
- Compact workbench density with clear panel boundaries.
- Muted neutral surfaces with one restrained emerald primary.
- Small, consistent controls optimized for repeated editing.
- Focus states and validation states that are visible but not loud.
- Explanatory surfaces that keep authorization logic close to the data.

## 2. Colors

The palette is a restrained mist-neutral system with a cool emerald primary used for decisions and primary actions.

### Primary

- **Investigation Emerald** (`primary`): Used for primary actions, selected badges, and affirmative permission emphasis. Its role is sparse, useful signal rather than brand decoration.
- **Pale Emerald Ink** (`primary-foreground`): Text and icon color on primary surfaces.

### Secondary

- **Quiet Control Mist** (`secondary`): Low-emphasis controls and secondary actions where hierarchy must stay behind the data.
- **Graphite Control Text** (`secondary-foreground`): Text on quiet control surfaces.

### Tertiary

- **Soft Focus Mist** (`accent`): Hover, active, and selected-menu backgrounds. Use it to show local interaction state without changing the whole panel hierarchy.
- **Deep Focus Text** (`accent-foreground`): Text on accent surfaces.

### Neutral

- **Paper White** (`background`, `card`): The default light workspace and card surface.
- **Ink Graphite** (`foreground`, `card-foreground`): Primary text and headings.
- **Relationship Mist** (`muted`): Secondary regions, empty fields, and subdued rows.
- **Audit Slate** (`muted-foreground`): Helper text, descriptions, timestamps, and supporting labels.
- **Boundary Mist** (`border`, `input`): Rings, separators, input borders, and panel outlines.
- **Focus Cloud** (`ring`): Keyboard focus rings and interactive outlines.
- **Decision Red** (`destructive`): Invalid states and destructive feedback only.

### Named Rules

**The Sparse Signal Rule.** The emerald primary is for action and authorization signal. Do not flood panels with it.

**The Mist Boundary Rule.** Most separation comes from thin rings, borders, and tonal shifts. Avoid heavy dividers or saturated panel backgrounds.

## 3. Typography

**Display Font:** Inter Variable (with sans-serif fallback)
**Body Font:** Inter Variable (with sans-serif fallback)
**Label/Mono Font:** Inter Variable unless a future code/path view introduces a dedicated mono stack.

**Character:** The type system is compact, neutral, and tool-like. It privileges scan speed over personality, with small sizes, medium labels, and relaxed line heights for dense data.

### Hierarchy

- **Display** (600, 1.125rem, 1.25): Reserved for page-level or major panel headings. Use rarely.
- **Headline** (500, 1rem, 1.3): Section headings and prominent explanatory labels.
- **Title** (500, 0.875rem, 1.25): Card titles, grouped control labels, and inspector headings.
- **Body** (400, 0.75rem, 1.5): Default workbench copy, row text, and compact explanations. Keep long explanation copy near 65 to 75 characters per line.
- **Label** (500, 0.75rem, 1.5): Form labels, button text, chip text, and field captions.

### Named Rules

**The Small Text, Strong Hierarchy Rule.** Snowball may use small type, but every panel must still have obvious title, body, helper, and action levels.

## 4. Elevation

Snowball uses tonal layering, one-pixel rings, and occasional popover shadows. Cards are flat at rest with `ring-1 ring-foreground/10`; menus use `shadow-md` only while floating above the workspace.

### Shadow Vocabulary

- **Popover Lift** (`shadow-md`): Select menus and other temporary overlays that need to separate from the dense workspace.
- **Flat Panel Ring** (`ring-1 ring-foreground/10`): Default card and panel boundary. This is the primary depth vocabulary.

### Named Rules

**The Flat Workbench Rule.** Persistent surfaces stay flat. Elevation appears only when an element temporarily floats above the model.

## 5. Components

### Buttons

- **Shape:** Compact rounded rectangles (medium radius, `calc(0.625rem * 0.8)`).
- **Primary:** Investigation Emerald background with Pale Emerald Ink text, usually 1.75rem high with tight horizontal padding.
- **Hover / Focus:** Primary buttons darken with opacity on hover. Focus uses a visible ring and border shift, never a glow-heavy effect.
- **Secondary / Ghost / Tertiary:** Secondary buttons use Quiet Control Mist; outline and ghost variants rely on border, muted fill, or hover state instead of extra color.

### Chips

- **Style:** Full-pill shape with 0.625rem type, tight horizontal padding, and role-specific fills.
- **State:** Primary chips mark important selected or affirmative states. Outline chips carry metadata without competing with controls.

### Cards / Containers

- **Corner Style:** Soft rounded panels (large radius, `0.625rem`).
- **Background:** Paper White or dark-mode card surfaces.
- **Shadow Strategy:** Flat Panel Ring by default; no resting shadows.
- **Border:** Thin foreground ring at low opacity.
- **Internal Padding:** Compact 1rem default padding, 0.75rem for small cards.

### Inputs / Fields

- **Style:** 1.75rem high, medium radius, thin border, and translucent input fill.
- **Focus:** Border moves to Focus Cloud and receives a two-pixel ring at low opacity.
- **Error / Disabled:** Error states use Decision Red border and ring; disabled fields reduce opacity and remove pointer interaction.

### Navigation

- **Style, typography, default/hover/active states, mobile treatment.** Navigation is control-like rather than brand-like: small labels, restrained icons, compact spacing, and muted hover fills. The current workbench is desktop-first with a wide minimum width, so future responsive navigation should preserve panel clarity before reducing density.

### Permission Explanation Surfaces

Permission explanations and audit records should read as evidence trails. Use muted surfaces, compact rows, and explicit labels for actor, permission, resource, result, and path steps. Never rely on color alone for allow/deny state.

## 6. Do's and Don'ts

### Do:

- **Do** use Investigation Emerald sparingly for primary action, selected state, and authorization signal.
- **Do** keep scenario editing, validation, and permission explanation visually close together.
- **Do** preserve compact workbench density with clear labels and visible focus states.
- **Do** use Flat Panel Rings for persistent containers and Popover Lift only for temporary overlays.
- **Do** communicate permission decisions with labels, icons, and explanation paths, not color alone.

### Don't:

- **Don't** use generic SaaS landing-page polish.
- **Don't** use decorative glassmorphism.
- **Don't** use neon cyber-security tropes.
- **Don't** use vague AI-dashboard styling.
- **Don't** use heavy enterprise admin chrome that hides the actual permission model.
- **Don't** use side-stripe borders, gradient text, or repeated identical marketing card grids.
