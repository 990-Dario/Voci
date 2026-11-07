# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML, CSS, and JavaScript without a framework or dependencies for the first version.

## Users

Students preparing for exams in German, English, French, mathematics and geography; teachers and verified school administrators manage shared class announcements.

## Product Purpose

Students select subject content, optionally set an exam date and practice independently. English/French retain textbook vocabulary and add grammar; German provides grammar, mathematics covers geometry and Pythagoras, and geography provides map exercises. Paid teacher and school features are implemented locally; operational setup and release verification remain pending.

## Positioning

The vocabulary is curated by the product owner to follow the teaching materials students already use.

## Operating Context

Students select English or French, choose one or more Units/Unités and learning objectives, set an exam date, then practice the selected words using timed matching, flashcards, multiple choice or written answers, and short practice tests.

## Capabilities and Constraints

- The app can optionally connect to Supabase for email/password accounts, cross-device synchronization, and seven-day learning-set links.
- Vocabulary lists are curated and grouped by language, course, Unit/Unité, and learning objective.
- The exam date, selected vocabulary, and learning progress are saved locally and synchronized per account when Supabase is configured.
- Practice tests show their evaluation after the last answer.
- Optional school features use a separate Supabase migration: verified school roles, classes, join codes, shared exam announcements, private study progress, notification preferences, and server-side billing/email integrations. See `docs/SCHULFUNKTION_EINRICHTEN.md` for activation.
- The first screen briefly introduces the learning offer before leading into vocabulary selection.

## Evidence on Hand

User-supplied Open World units 1–21 are included. Grammar questions are original draft exercises awaiting expert review. Map data derives from Natural Earth and swisstopo. Availability of source files does not establish redistribution rights or official publisher approval.

## Product Principles

- Keep the chosen textbook vocabulary and its learning objectives clear.
- Let students get from exam preparation to practice with few steps.
- Keep progress private to the student's account with database policies that restrict every record to its owner.
