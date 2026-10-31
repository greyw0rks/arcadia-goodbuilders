---
name: Arcadia Floating Arcade
description: A little play. A good day.
colors:
  arcade-violet: "#7564F6"
  action-violet: "#5747D9"
  electric-blue: "#2D83F7"
  mint-pop: "#55E6A5"
  prize-gold: "#FFC857"
  coral: "#FF7A70"
  ink-navy: "#17182B"
  paper: "#F7F6F2"
  raised: "#FFFFFF"
  soft-text: "#666477"
  line: "#E5E2ED"
  portal-field: "#EAE6FC"
typography:
  display:
    fontFamily: '"Arcadia Display", sans-serif'
    fontSize: "clamp(27px, 2.5vw, 36px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: '"Arcadia UI", ui-sans-serif, system-ui, sans-serif'
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: '"Arcadia UI", sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  control: "11px"
  navigation: "12px"
  card: "16px"
spacing:
  compact: "12px"
  group: "16px"
  panel: "24px"
  desktop: "34px"
components:
  button-primary:
    backgroundColor: "{colors.action-violet}"
    textColor: "{colors.raised}"
    rounded: "{rounded.control}"
    height: "46px"
    typography: "{typography.control}"
  surface:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.card}"
    padding: "24px"
---
# Design System: Arcadia Floating Arcade

## Overview

**Creative North Star: "Floating arcade world"**

Arcadia pairs original dimensional arcade islands with a warm, readable application. The portal, trophy, chest and podium signal the purpose of each destination. Play screens concentrate on the question and answers; the environment stays out of the timed interaction.

The user selected this playful, rounded world and its violet, blue, mint, gold, coral and navy palette. This replaces the previous flat arcade layout. The existing Gateway A identity and outlined wordmark remain.

**Key Characteristics:**

- Original Blender geometry and matching static artwork.
- Warm page surfaces with violet actions and clear navy text.
- Compact navigation and large mobile answers.
- Visible XP progress and truthful money states.

## Colors

Arcade Violet carries the identity, while the darker action violet supports readable white button labels. Electric Blue, Mint Pop and Coral distinguish genres and feedback; Prize Gold marks achievements. Ink Navy anchors text and the focused game backdrop. Paper and raised surfaces keep the application light.

**The Readable Score Rule.** Set standings backgrounds and foregrounds together. Both the player row and other entrants must remain readable; never inherit light-surface text into a dark legacy row.

## Typography

Space Grotesk is self-hosted as Arcadia Display; Inter is self-hosted as Arcadia UI. Headings use balanced wrapping and a 700 weight. Main page headings range from 27 to 36px; the portal heading uses a responsive 26 to 44px scale. Questions use 24px on small phones. Scores and timers use Inter with tabular numerals. The logo wordmark remains outlined Manrope artwork.

**The Context Rule.** Game number, multiplier and cap are useful metadata. Place them in the status area or below the heading, without an above-heading eyebrow treatment.

## Layout

The desktop shell has a 206px sidebar and a fluid workspace, with content capped at 1490px and 34px side padding. At 980px the sidebar becomes an icon rail; at 740px it becomes a five-item bottom navigation. Phone content uses 17px side padding, reducing to 13px below 350px. Main gaps are 24px; related controls use 12–16px.

Required weekly entry is the primary Play stage after verification and before genre selection. Entry copy, approval, recovery and errors stay together. During active questions, navigation and the tournament rail disappear; each new question begins in view.

## Elevation & Depth

Dimensionality comes from original rendered geometry rather than CSS imitation. Ordinary panels use tonal surfaces and restrained lines. The wallet panel uses a soft elevated shadow (`0 16px 55px #25203a26`) because it overlays the current page. Do not stack decorative shadows on every card.

## Shapes

Cards use 16px corners, navigation items 12px, and primary controls 11px. Islands and assets use rounded glossy geometry with real lighting. The portal contains a dimensional Gateway A emblem. SVG icons share a consistent stroke; illustrations come from the Blender assets.

## Components

Primary buttons use the darker action violet, white labels and at least 46px height. Disabled controls retain their meaning; pending transactions expose recovery rather than silently resubmitting. Keyboard focus stays visible.

Navigation links have persistent accessible names even when their visible labels are hidden. The current destination receives a pale violet field. The mobile Rewards shortcut remains named.

Answer targets are full-width on phones, at least 63px high, with explicit correct/wrong feedback. New answers advance after 1.2 seconds. Results show the saved XP, rate and applicable cap. No XP celebration implies that G$ was paid.

3D scenes load lazily, render on demand at a limited rate, stop offscreen/hidden, and become idle after 12 seconds. Players can pause or replay them. Reduced motion, save-data and WebGL failure show static WebP assets. Timed questions never load a 3D scene.

## Do's and Don'ts

- Do keep the question and all answers readable on phones.
- Do show entry, identity, XP and money states truthfully.
- Do retain static alternatives for every dimensional scene.
- Do preserve accessible names when visual labels disappear.
- Don't use a legacy dark row with navy foreground text.
- Don't hide a required entry action beneath an unusable start screen.
- Don't imply current G$ claims, refunds or paid collection are live.
- Don't turn above-heading labels into a recurring design pattern.
