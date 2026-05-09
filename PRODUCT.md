# Product

## Register

product

## Users

Snowball is for engineers, product builders, and security-minded teams experimenting with relationship-based access control. They use the workbench while modeling organizations, users, groups, tasks, resources, and permission paths, often needing to understand why a user can or cannot see or act on something.

## Product Purpose

Snowball exists to make ReBAC scenarios inspectable and editable in a local task workbench. The product lets users build scenario graphs, switch actors, evaluate permissions, inspect path explanations, persist scenarios, and audit changes so authorization rules can be reasoned about before they are embedded in production systems.

Success looks like fast, confident comprehension: a user can change a relationship or task, immediately see the authorization impact, and trust the explanation trail without needing to read library internals.

## Brand Personality

Precise, calm, and investigative. The interface should feel like a serious workbench for modeling access decisions: compact, legible, and transparent, with enough warmth to keep dense authorization data approachable.

## Anti-references

Avoid generic SaaS landing-page polish, decorative glassmorphism, neon cyber-security tropes, vague AI-dashboard styling, and heavy enterprise admin chrome that hides the actual permission model. The product should not feel like a marketing site, a dark hacker console, or a form generator with authorization labels pasted on top.

## Design Principles

1. Make causality visible. Permission decisions should connect actors, relationships, resources, and paths without forcing users to infer the chain.
2. Preserve workbench density without clutter. Dense data is acceptable when hierarchy, spacing, and labeling keep scanning fast.
3. Prioritize edit-and-explain loops. Scenario changes, validation feedback, and authorization explanations should feel close together.
4. Treat auditability as a first-class surface. Changes and checks should leave readable traces, not hidden side effects.
5. Stay tool-like, not theatrical. Visual choices should support precision and trust rather than calling attention to themselves.

## Accessibility & Inclusion

Use accessible semantics for controls, labels, alerts, and navigation. Maintain visible keyboard focus, sufficient color contrast in light and dark themes, and non-color-only status communication for permission decisions, validation issues, and destructive states. Motion should be limited to short state transitions and respect reduced-motion preferences.
