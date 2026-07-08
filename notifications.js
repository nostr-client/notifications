/**
 * notifications.js — <nostr-notifications>: mentions, replies, reposts and
 * reactions to you, live. No build step.
 *
 * Part of https://github.com/nostr-client — one repo, one thing.
 * License: AGPL-3.0-or-later
 *
 * Usage:
 *   <script type="module" src="https://nostr-client.github.io/notifications/notifications.js"></script>
 *   <nostr-notifications></nostr-notifications>       <!-- logged-in user -->
 *   <nostr-notifications pubkey="<hex>"></nostr-notifications>
 *
 * Clicking a row dispatches 'nostr:note-click' with { event, targetId } —
 * targetId is the referenced note (hex), so clients can open the thread.
 */

import { Pool, defaultPool } from 'https://nostr-client.github.io/pool/pool.js'
import { profiles, formatAgo } from 'https://nostr-client.github.io/note/note.js'
import { npubShort } from 'https://nostr-client.github.io/nip19/nip19.js'

const HEX64 = /^[0-9a-f]{64}$/

const TEMPLATE = /* html */ `
<style>
  :host { display: block;
    font-family: var(--nc-font, ui-sans-serif, system-ui, sans-serif);
    font-size: .9rem; color: var(--nc-ink, #201d26); }
  .status { font-size: .78rem; color: var(--nc-faint, #a8a4b0); margin: .5rem .2rem; }
  #rows { display: grid; gap: .5rem; }
  .row { display: flex; gap: .7rem; align-items: flex-start; padding: .65rem .9rem;
    background: var(--nc-surface, #fff); border: 1px solid var(--nc-line, #e9e6e0);
    border-radius: var(--nc-radius-sm, 9px); cursor: pointer;
    transition: border-color .15s ease; }
  .row:hover { border-color: var(--nc-faint, #a8a4b0); }
  .icon { font-size: 1rem; flex: none; width: 1.4em; text-align: center; }
  .icon.like { color: var(--nc-danger, #c93a3a); }
  .icon.repost { color: var(--nc-ok, #17864f); }
  .icon.reply { color: var(--nc-accent, #7c3aed); }
  .what { min-width: 0; flex: 1; }
  .who { font-weight: 650; }
  .when { color: var(--nc-faint, #a8a4b0); font-size: .8em; }
  .snippet { color: var(--nc-soft, #6d6a76); overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; margin-top: .15rem; }
  .empty { padding: 1.4rem; text-align: center; color: var(--nc-soft, #6d6a76);
    border: 1px dashed var(--nc-line, #e9e6e0); border-radius: var(--nc-radius, 14px); }
</style>
<div class="status" id="status"></div>
<div id="rows"></div>
`

class NostrNotifications extends HTMLElement {
  static observedAttributes = ['pubkey']

  constructor() {
    super()
    this.attachShadow({ mode: 'open' }).innerHTML = TEMPLATE
    this.$ = (id) => this.shadowRoot.getElementById(id)
    this.pool = null
    this.sub = null
    this.seen = new Set()
    this._onAuth = () => this._start()
  }

  connectedCallback() {
    window.addEventListener('nostr:login', this._onAuth)
    window.addEventListener('nostr:logout', this._onAuth)
    this._start()
  }

  disconnectedCallback() {
    window.removeEventListener('nostr:login', this._onAuth)
    window.removeEventListener('nostr:logout', this._onAuth)
    this.sub?.close()
  }

  attributeChangedCallback() { if (this.isConnected) this._start() }

  get _pool() {
    if (!this.pool) {
      const relays = this.getAttribute('relays')
      this.pool = relays ? new Pool(relays.split(',').map((s) => s.trim())) : defaultPool()
    }
    return this.pool
  }

  _start() {
    this.sub?.close()
    this.$('rows').innerHTML = ''
    this.seen.clear()
    const me = (this.getAttribute('pubkey') || window.nostrPubkey || '').toLowerCase()
    if (!HEX64.test(me)) {
      this.$('status').textContent = ''
      const empty = document.createElement('div')
      empty.className = 'empty'
      empty.textContent = 'Log in to see your notifications.'
      this.$('rows').append(empty)
      return
    }
    this.me = me
    this.$('status').textContent = 'loading…'
    let count = 0
    this.sub = this._pool.subscribe(
      [{ kinds: [1, 6, 7], '#p': [me], limit: Number(this.getAttribute('limit') || 40) }],
      {
        onEvent: (event) => {
          if (event.pubkey === me || this.seen.has(event.id)) return
          this.seen.add(event.id)
          count++
          this._addRow(event)
        },
        onEose: () => {
          this.$('status').textContent = count ? count + ' notifications · live' : 'nothing yet · live'
        },
      }
    )
  }

  _addRow(event) {
    const row = document.createElement('div')
    row.className = 'row'

    const icon = document.createElement('span')
    icon.className = 'icon'
    let label
    if (event.kind === 7) {
      icon.classList.add('like')
      icon.textContent = event.content === '-' ? '👎' : (event.content === '+' || !event.content ? '♥' : event.content.slice(0, 2))
      label = ' reacted to your note'
    } else if (event.kind === 6) {
      icon.classList.add('repost')
      icon.textContent = '↻'
      label = ' reposted your note'
    } else if (event.tags.some((t) => t[0] === 't' && t[1] === 'onchain-tip')) {
      icon.textContent = '₿'
      icon.style.color = '#f7931a'
      const sats = Number(event.tags.find((t) => t[0] === 'amount')?.[1] ?? 0)
      label = sats ? ` tipped you ${sats.toLocaleString()} sats` : ' tipped you'
    } else {
      icon.classList.add('reply')
      icon.textContent = '💬'
      label = ' mentioned or replied to you'
    }

    const what = document.createElement('div')
    what.className = 'what'
    const who = document.createElement('span')
    who.className = 'who'
    who.textContent = npubShort(event.pubkey)
    const rest = document.createElement('span')
    rest.textContent = label + ' '
    const when = document.createElement('span')
    when.className = 'when'
    when.textContent = formatAgo(event.created_at)
    what.append(who, rest, when)

    if (event.kind === 1 && event.content) {
      const snippet = document.createElement('div')
      snippet.className = 'snippet'
      snippet.textContent = event.content.slice(0, 140)
      what.append(snippet)
    }

    row.append(icon, what)

    const eTags = event.tags.filter((t) => t[0] === 'e' && HEX64.test(t[1] ?? ''))
    const targetId = event.kind === 1 ? event.id : (eTags[eTags.length - 1]?.[1] ?? event.id)
    row.onclick = () => this.dispatchEvent(new CustomEvent('nostr:note-click', {
      detail: { event, targetId }, bubbles: true, composed: true,
    }))

    profiles(this._pool).get(event.pubkey, (profile) => {
      const display = profile?.display_name || profile?.name
      if (display) who.textContent = display
    })

    // newest first by created_at
    const rows = this.$('rows')
    row.dataset.ts = event.created_at
    let next = null
    for (const el of rows.children) {
      if (Number(el.dataset.ts) < event.created_at) { next = el; break }
    }
    rows.insertBefore(row, next)
    while (rows.children.length > 120) rows.lastChild.remove()
  }
}

if (!customElements.get('nostr-notifications')) customElements.define('nostr-notifications', NostrNotifications)
