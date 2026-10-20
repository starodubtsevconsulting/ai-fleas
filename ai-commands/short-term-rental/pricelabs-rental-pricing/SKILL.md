---
name: pricelabs-rental-pricing
description: Inspect or update a short-term rental's minimum nightly price in PriceLabs when rates flow through Lodgify to booking channels; verify overrides, sync, and channel prices.
---

# PriceLabs rental pricing

Use this skill for a host's nightly-rate floor, not PriceLabs vendor invoices or cleaning fees. Identify the intended listing by its live PriceLabs-to-Lodgify connection before reading or editing. Keep real property names, IDs, addresses, and prices out of reusable documentation.

## Locate the price source

1. In Lodgify, check whether **External rates** are active for the rental. If they are, follow the connected PriceLabs listing rather than assuming Lodgify's base-price screen controls daily rates.
2. In PriceLabs **Dynamic Pricing → Pricing Dashboard**, match the listing and Lodgify connection. Read its currency, **Min Price**, **Base Price**, **Max Price**, **Enable Price Sync**, and last synced time. **Review Prices** opens the listing calendar with editable **Minimum**, **Base**, and **Maximum** fields.
3. Report the configured minimum as a *PriceLabs recommended nightly-rate floor*. Do not call it a guaranteed final guest price. [PriceLabs explains the three price fields](https://help.pricelabs.co/portal/en/kb/articles/what-are-minimum-base-and-maximum-prices-how-to-set-them-up).

## Change and verify a minimum

- Distinguish an exploratory question from an instruction to change the rate. For an authorized change, inspect the calendar and relevant account, group, listing, seasonal, and date-specific customizations before editing. Fixed date-specific prices and certain other overrides can fall below the default minimum; [PriceLabs documents these exceptions](https://help.pricelabs.co/portal/en/kb/articles/customizations-which-allow-below-minimum-prices). If the requested minimum exceeds the current base price, explain the relationship and review the resulting calendar before saving; do not silently alter the base or maximum.
- Set **Minimum** for the correct listing, use **Save & Refresh**, and verify the persisted value and representative low-demand dates. If the host needs rates pushed immediately and price sync is enabled, use **Sync Now**, then refresh and check **Last Synced** and any error. Otherwise explain that PriceLabs normally syncs once daily; do not invent a shorter completion time. See [PriceLabs sync guidance](https://help.pricelabs.co/portal/en/kb/articles/how-often-are-my-rates-sycned-to-my-pms-and-how-does-sync-now-work).
- Verify the result in Lodgify's **Multi-calendar**, where [PriceLabs says synced rates appear](https://help.pricelabs.co/portal/en/kb/articles/lodgify). Then inspect representative public dates or price breakdowns on each connected booking channel when the task concerns the guest-facing floor. Channel markups, promotions, length-of-stay discounts, taxes, and fees can change what a guest sees or pays. Do not change those settings merely to make a PriceLabs minimum appear uniform across sites.
- Report what was saved, whether it synced, which channels were checked, any dates or overrides below the requested floor, and what remains unverified. Existing reservations are historical and should not be repriced by this workflow.
