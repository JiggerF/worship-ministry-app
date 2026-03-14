# CLAUDE.md

This file provides guidance for Claude when working inside this repository.

The goal is to ensure that all AI-assisted development follows consistent architectural, engineering, and product standards.

---

# Project Overview

This repository contains the **Worship Ministry Platform**, a SaaS application designed to support church worship teams.

The platform manages:

- Worship team rostering
- Music library management
- Worship service planning
- Asset tracking for church equipment
- AI-assisted workflow automation

The system is designed to support **multiple churches (multi-tenancy)** in the future while maintaining strict data isolation.

---

# Core Product Principles

The product prioritizes:

1. **Simplicity for volunteers**
2. **Operational reliability**
3. **Clear workflows**
4. **Low cognitive load**
5. **Safe automation using AI agents**

Users are often volunteers with limited technical experience.  
The interface and workflows must remain **intuitive and easy to learn**.

---

# Architecture Principles

All system changes should follow these architectural principles:

### Simplicity First
Prefer simple solutions over complex abstractions.

### Safe Evolution
Avoid breaking existing functionality.  
Design migrations carefully.

### Tenant Isolation
Future architecture must support strict tenant separation.

### Configurability
Avoid hard-coded rules when possible.  
Use configuration to support future flexibility.

### Observability
Systems should be debuggable and transparent.

---

# Engineering Standards

Claude should prioritize:

- readable code
- maintainable structure
- clear naming
- minimal complexity
- separation of concerns

Avoid:

- unnecessary abstractions
- overly clever solutions
- tightly coupled modules

---

# Testing Expectations

All features should be testable.

The system should include:

- unit tests
- integration tests
- workflow validation
- edge case coverage

Particular attention should be given to:

- roster generation logic
- multi-tenant data safety
- AI agent behavior

---

# AI Agent Philosophy

The platform uses **AI agents to automate operational tasks**.

Agents should be designed with:

- clear responsibilities
- predictable outputs
- human oversight when necessary
- safe fallback behavior

Agents should **assist humans**, not replace oversight.

---

# Skills System

This repository uses a structured **Claude Skills system**.

Skills represent specialized expert roles such as:

- Product Manager
- SaaS Architect
- Staff Software Engineer
- AI Systems Designer
- SDET / Quality Engineer
- UX Designer
- Systems Thinking

Claude should activate relevant skills depending on the task.

Do not load unnecessary skills simultaneously.

---

# Development Workflow

When implementing a feature, Claude should follow this planning sequence:

1. Feature Definition
2. Architecture Design
3. Implementation Plan
4. Testing Strategy
5. Release Safety Review

These prompts exist in: