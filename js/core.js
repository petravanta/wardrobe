'use strict';
/* Wardrobe. A catalogue of the clothes you own, outfits made from them, and a log of what you wore.
   Built-in knowledge (types, colours, materials, sizes…) comes from data/*.json; items refer to it by id.
   User data follows the "User data" section of petravanta/general STANDARDS.md: one JSON document, a working copy in
   localStorage, optional sync to "Wardrobe data.json" in the user's Google Drive.
   Photos live in this browser (IndexedDB) and, if connected, in a Wardrobe album in the user's Google Photos (GPhotos below). */

/* Google Drive sync: the shared OAuth client for petravanta.github.io (see README). Leave empty to turn Drive off. */
const GOOGLE_CLIENT_ID = '326863468616-4hf2conk0ks0s4qdva9tphphdo7ht7eh.apps.googleusercontent.com';
const KEY = 'wardrobe.data', TAB_KEY = 'wardrobe.tab';
const LISTS = ['items', 'outfits', 'wears', 'words'];
const DATASETS = ['types', 'colours', 'materials', 'seasons', 'occasions', 'care', 'size-systems', 'gender-tags', 'colour-seasons', 'colour-quiz'];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
// A timestamp's calendar day where you are (not UTC, which is already tomorrow on a US evening)
const localDay = (t = Date.now()) => { const d = new Date(t); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const today = () => localDay();
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
