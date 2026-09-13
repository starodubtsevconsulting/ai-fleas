# activity-data-android provider specification

## Purpose

Implement the `activity-data` contract using user-authorized Android device usage statistics, with emphasis on mobile screen time and application/category usage.

## Evidence

When available and authorized, normalize total screen time, per-app duration, category duration, social-media duration, unlock/pickup-like counts, and time-of-day usage.

## Acquisition

Implementation may use supported Android usage-statistics/export mechanisms available to the user's device. The provider must report the acquisition mechanism in `info` and must not silently escalate to broader device access.

## Privacy

Collect usage metadata only. Do not collect message/notification content, keystrokes, browser page contents/history, media, contacts, microphone/camera data, or location for this command.

Read-only v1. Profile authorization is required.

## Interpretation boundary

The provider reports observations only. It does not label apps or periods as procrastination, addiction, productive/unproductive behavior, or make Governor decisions. Category mappings such as `social-media` are descriptive configuration/data classifications and remain inspectable.
