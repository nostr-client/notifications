# notifications

`<nostr-notifications>` — mentions, replies, reposts and reactions to you,
live. **No build step.** One file: [`notifications.js`](notifications.js).

Part of [nostr-client](https://github.com/nostr-client) — a modular, composable
nostr client where each repo does one thing.

**Live demo:** https://nostr-client.github.io/notifications/

## Use

```html
<script type="module" src="https://nostr-client.github.io/notifications/notifications.js"></script>

<nostr-notifications></nostr-notifications>            <!-- the logged-in user -->
<nostr-notifications pubkey="<hex>"></nostr-notifications>
```

One `#p` filter over kinds 1/6/7, streamed live and deduped. Rows show who,
what (💬 reply/mention · ↻ repost · ♥/emoji reaction) and when, with profile
names resolved through the shared page-wide resolver.

Clicking a row dispatches `nostr:note-click` with `{ event, targetId }` —
`targetId` is the hex id of the note to open (for reactions/reposts, the note
that was reacted to), so a client can route straight into
[thread](https://github.com/nostr-client/thread).

## License

AGPL-3.0-or-later
