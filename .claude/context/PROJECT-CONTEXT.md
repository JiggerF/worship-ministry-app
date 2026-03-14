# Project Context

## Project Name
Worship Ministry Platform

## Purpose
This project is a SaaS platform designed to help churches manage worship ministry operations.

The platform provides tools to support ministry leaders and volunteers in organizing weekly services and managing worship teams.

Core goals:
- reduce administrative workload for church leaders
- improve volunteer coordination
- maintain doctrinal and operational integrity in worship ministry
- provide AI-assisted tools that support (not replace) human leadership

---

# Platform Capabilities

The platform currently supports the following domains:

### Worship Team Management
- volunteer management
- team roles
- availability tracking
- ministry roster scheduling

### Song Library
- worship song database
- theological review tracking
- scriptural references
- approved song pool management

### Equipment & Asset Tracking
- instruments
- sound equipment
- maintenance tracking
- purchase request workflows

### AI-Assisted Tools
- roster recommendation agent
- fairness and workload analysis
- burnout prevention suggestions

AI agents **provide recommendations only**.  
They never automatically commit operational changes without human approval.

---

# Current Architecture

The platform currently operates as a **single-tenant application** used by one church.

All data currently belongs to a single organization instance.

Features implemented today include:

- volunteer management
- roster scheduling
- song library
- worship team operations
- AI-assisted roster recommendations

---

# Future Architecture Direction

The platform is being designed to evolve into a **multi-tenant SaaS platform** supporting multiple churches.

In this future model:

- each church will be a **tenant**
- all tenant data will be scoped by `tenant_id`
- the platform owner ("landlord") will manage tenant configuration
- features may be enabled or disabled per tenant

Examples of tenant-scoped data:

- volunteers
- rosters
- songs
- equipment
- availability
- ministry settings

This multi-tenant model is **not yet implemented**, but all new architecture decisions should consider this future direction to avoid major refactoring later.

# Current Architecture

The platform currently operates as a **single-tenant application** used by one church.

All data currently belongs to a single organization instance.

Features implemented today include:

- volunteer management
- roster scheduling
- song library
- worship team operations
- AI-assisted roster recommendations

---

# Future Architecture Direction

The platform is being designed to evolve into a **multi-tenant SaaS platform** supporting multiple churches.

In this future model:

- each church will be a **tenant**
- all tenant data will be scoped by `tenant_id`
- the platform owner ("landlord") will manage tenant configuration
- features may be enabled or disabled per tenant

Examples of tenant-scoped data:

- volunteers
- rosters
- songs
- equipment
- availability
- ministry settings

This multi-tenant model is **not yet implemented**, but all new architecture decisions should consider this future direction to avoid major refactoring later.