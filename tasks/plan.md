# Implementation Plan: Voci Schüler-Version

## Overview

Build a small static web app for students to select textbook vocabulary for an exam and practice it in four modes. Keep vocabulary in editable JSON and save the student's exam setup and progress in the browser.

## Architecture Decisions

- Use native HTML, CSS, and JavaScript; no framework or dependencies.
- Use a JSON file for sample vocabulary, clearly marked as illustrative until real textbook lists are supplied.
- Use `localStorage` for the exam date, chosen vocabulary, and progress; no account or server.
- Evaluate practice tests after the final answer.

## Task List

### Phase 1: Selection flow
- [ ] Add the responsive page shell, vocabulary data, language/Unit/objective selection, exam date, and local persistence.

### Phase 2: Learning modes
- [ ] Add timed matching, flashcards, multiple choice/written answers, and end-scored practice tests for the selected list.

### Checkpoint: Complete
- [ ] Confirm all four modes consume the selected list and local setup survives a browser reload.
- [ ] Confirm keyboard navigation and narrow-screen layout.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Example vocabulary could be mistaken for official textbook content | Incorrect learning material | Label examples as demos and replace them when curated lists are provided. |
| Browser data is local to one device/browser | Progress does not sync | State this in the UI; account-based sync is outside this version. |

## Open Questions

- Real textbook vocabulary has not yet been provided.
