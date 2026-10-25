# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML, CSS, and JavaScript without a framework or dependencies for the first version.

## Users

Students preparing for English and French vocabulary exams based on their school textbooks.

## Product Purpose

Students choose the vocabulary they need for an exam by language, Unit/Unité, and learning objective, set the exam date, and practice with focused learning modes. The first version serves students; teacher features come later.

## Positioning

The vocabulary is curated by the product owner to follow the teaching materials students already use.

## Operating Context

Students select English or French, choose one or more Units/Unités and learning objectives, set an exam date, then practice the selected words using timed matching, flashcards, multiple choice or written answers, and short practice tests.

## Capabilities and Constraints

- The app can optionally connect to Supabase for email/password accounts, cross-device synchronization, and seven-day learning-set links.
- Vocabulary lists are curated and grouped by language, course, Unit/Unité, and learning objective.
- The exam date, selected vocabulary, and learning progress are saved locally and synchronized per account when Supabase is configured.
- Practice tests show their evaluation after the last answer.
- Teacher functions are later work.
- The first screen briefly introduces the learning offer before leading into vocabulary selection.

## Evidence on Hand

No textbook vocabulary files or other learning-content assets have been provided yet. Do not present sample vocabulary as official textbook content.

## Product Principles

- Keep the chosen textbook vocabulary and its learning objectives clear.
- Let students get from exam preparation to practice with few steps.
- Keep progress private to the student's account with database policies that restrict every record to its owner.
