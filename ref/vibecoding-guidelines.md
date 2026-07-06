# Software Development Guidelines

This document defines the engineering standards for this project. Treat these as default requirements unless explicitly overridden by the project prompt.

---

# Core Philosophy

Build production-quality software, not demonstrations or isolated code snippets.

The project should remain functional throughout development, with every completed feature integrated into the application before moving on.

Prioritize maintainability, readability, and extensibility over short-term speed.

---

# Architecture

- Separate application logic from rendering, UI, input, networking, persistence, and audio.
- Design modular systems with clear responsibilities.
- Keep systems loosely coupled.
- Prefer composition over inheritance.
- Avoid global state where possible.
- Build systems that can be expanded without major rewrites.

---

# Development Workflow

Implement one complete feature at a time.

For every feature:

1. Design the system.
2. Implement it.
3. Verify it works in the running application.
4. Fix any issues immediately.
5. Refactor if necessary.
6. Only then continue to the next feature.

Never leave multiple partially implemented systems.

The project should always remain in a working state.

---

# Code Quality

Write code intended for long-term maintenance.

- Use descriptive names.
- Keep functions and files focused.
- Minimize duplication.
- Prefer clarity over cleverness.
- Eliminate dead code instead of commenting it out.
- Refactor when complexity begins to grow.
- Comment intent rather than implementation.

---

# Technology

Unless the project specifies otherwise:

- Use modern language features.
- Avoid unnecessary dependencies.
- Avoid unnecessary build tooling.
- Keep the project portable.
- Favor open standards.
- Organize files logically.

---

# User Experience

The application should feel polished.

Provide:

- Responsive controls
- Immediate visual feedback
- Smooth animations where appropriate
- Consistent interface design
- Helpful onboarding or tutorials
- Clear and actionable error messages

---

# Performance

Continuously consider performance.

- Avoid unnecessary allocations.
- Avoid redundant calculations.
- Reuse resources where practical.
- Profile before optimizing.
- Keep the application responsive throughout development.

---

# Debugging

When issues occur:

- Find the root cause.
- Fix the underlying problem.
- Avoid temporary workarounds.
- Verify the solution does not introduce regressions.

---

# Autonomous Decision Making

Continue implementation without asking for confirmation on routine engineering decisions.

Choose the most maintainable solution when multiple reasonable approaches exist.

Only stop for clarification when:

- Requirements conflict.
- A decision would significantly change the product.
- Multiple interpretations would produce substantially different outcomes.

For major architectural decisions, briefly explain the reasoning before proceeding.

---

# Repository Standards

Maintain the project as though it will be handed to another engineer.

- Keep folders organized.
- Remove obsolete code.
- Keep documentation current.
- Keep naming consistent.
- Keep the project runnable throughout development.
- Prefer incremental, shippable progress over large rewrites.

---

# Testing

As each feature is completed:

- Verify it works in the running application.
- Test edge cases where practical.
- Ensure new functionality does not break existing systems.
- Fix regressions immediately.

---

# Quality Standards

Avoid placeholder implementations.

Avoid TODOs for requested functionality.

Every completed feature should feel complete, integrated, and tested before moving on.

---

# Definition of Done

The project is complete only when:

- All requested functionality is implemented.
- The application runs correctly from a clean checkout.
- No placeholder code remains.
- The codebase is organized and maintainable.
- The application is polished rather than merely functional.

The objective is to produce software that another experienced engineer could confidently continue developing.