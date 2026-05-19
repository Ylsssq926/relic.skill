# EARS Format Reference

## Overview
EARS (Easy Approach to Requirements Syntax) is a pattern-based approach for writing requirements in a clear, unambiguous, and testable format.

## EARS Patterns

### 1. Ubiquitous
- **Pattern**: The [system] shall [action]
- **Usage**: For requirements that always apply
- **Example**: The system shall display all prices in the user's local currency

### 2. Event-Driven
- **Pattern**: When [trigger], the [system] shall [action]
- **Usage**: For requirements triggered by an event
- **Example**: When the user clicks "Submit", the system shall validate all form fields

### 3. Unwanted Behavior
- **Pattern**: If [unwanted condition], then the [system] shall [action]
- **Usage**: For error handling and edge cases
- **Example**: If the network connection is lost, then the system shall display a reconnect prompt

### 4. State-Driven
- **Pattern**: While [state], the [system] shall [action]
- **Usage**: For requirements that apply during a specific state
- **Example**: While the modal is open, the system shall prevent background scrolling

### 5. Optional Feature
- **Pattern**: Where [feature] is enabled, the [system] shall [action]
- **Usage**: For feature-flagged or optional requirements
- **Example**: Where dark mode is enabled, the system shall use the dark color palette

### 6. Complex
- **Pattern**: While [state], if [trigger], then the [system] shall [action]
- **Usage**: For requirements combining state and event
- **Example**: While the user is logged in, if the session expires, then the system shall redirect to login

## Acceptance Criteria Format
Each requirement should include:
- **Given**: Precondition
- **When**: Trigger/action
- **Then**: Expected outcome
