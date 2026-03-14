Use the following skills:

- Product Manager
- SaaS Architect
- Systems Thinking
- Staff Software Engineer
- SDET / Quality Engineer

Use the system knowledge from:
.claude/context/PROJECT-CONTEXT.md

We are planning a new architectural feature or system change.

Your task is to conduct a **technical design review**, similar to what a senior engineering team would do before implementation.

Please analyze the proposal using the perspectives of product design, system architecture, implementation feasibility, and quality assurance.

Produce a structured design review with the following sections:

1. Problem Definition  
Clearly describe the problem we are trying to solve.

2. Current System Assessment  
Explain how the current system behaves and what architectural assumptions exist.

3. Proposed Architecture  
Describe the recommended system design.

4. Data Model / Schema Implications  
Explain how the data model should evolve.

5. Service Layer Design  
Describe how application services should change.

6. Risks and Failure Modes  
Identify potential technical risks or operational issues.

7. Testing Strategy  
Recommend how this change should be validated with automated tests.

8. Migration Strategy  
If the system already exists, explain how to safely evolve the system without breaking existing functionality.

9. Simpler Alternatives  
If a simpler approach exists, explain it.

10. Recommended Implementation Phases  
Break the work into safe implementation phases that an engineering team could execute.

Focus on:
- simplicity
- maintainability
- scalability
- operational safety
- minimizing risky rewrites.