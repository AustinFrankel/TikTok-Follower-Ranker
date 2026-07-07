# TikTok Follower Ranker

A simple browser-console script that ranks TikTok followers by follower count.

I made this for `@austinfrankel1` so I can quickly see the top TikTok followers by audience size.

## What it does

- Gets the followers for one TikTok account.
- Checks follower counts when TikTok returns them.
- Sorts everyone from most followers to least followers.
- Shows the top 30 in the console.
- Opens a small clickable popup with profile links.
- Saves the results so they are easy to copy.

## What it does not do

- It does not ask for your password.
- It does not use a third-party login.
- It does not follow or unfollow anyone.
- It does not message anyone.
- It does not change your TikTok account.
- It does not store your data anywhere.

## How to use it

1. Go to [tiktok.com](https://www.tiktok.com) in your browser.
2. Log into your account.
3. Open Inspect Element.
4. Go to the Console tab.
5. Copy everything from `tiktok-follower-ranker.js`.
6. Paste it into the console and press Enter.
7. Wait while it checks the followers.
8. Use the popup or console table to see the results.

## How to copy the final top followers

After the script finishes, paste this into the console:

```js
copy(
  window.austinTikTokTopFollowers
    .map((user) => `#${user.rank} @${user.username} — ${user.followers.toLocaleString()} followers — ${user.profileUrl}`)
    .join("\n")
);
```

That copies the ranked list to your clipboard.

## Important notes

TikTok changes its web endpoints more often than Instagram. If the script stops working, TikTok may have changed or blocked the internal follower-list request.

This is meant for checking your own account. Keep it basic and do not spam requests.

## File

- `tiktok-follower-ranker.js` — the full script to paste into the TikTok console.
