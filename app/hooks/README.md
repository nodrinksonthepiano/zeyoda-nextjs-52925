For full project setup and overview documentation, please see the [root README.md](../../README.md).

### Architectural Rules for Hooks

1.  **Stateful Logic Lives in Hooks:** Any complex state management, side effects (`useEffect`), or business logic should be encapsulated within a custom hook in this directory.

2.  **UI Lives in Components:** Hooks should be UI-agnostic. They should not contain JSX, Tailwind classes, or any other presentation-specific code. They should only return data and callbacks. This is to keep presentation and logic separate for easier testing and maintenance. 