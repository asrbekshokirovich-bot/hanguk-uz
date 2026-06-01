# Korea proxy setup (so the crawler can read `.ac.kr` sites)

**Why:** Korean university sites block visitors with non‑Korean IP addresses. Our crawler runs
on GitHub's servers (US IPs), so it gets blocked (HTTP 403). The fix: rent a tiny computer in
**Seoul**, turn it into a "relay" (proxy), and point our system at it — now requests look Korean
and go through. Cost ≈ **$5–6/month**. Time ≈ **20–30 minutes**, once.

You only need to do this once. When you're done, add one GitHub secret and tell Claude
"proxy is ready" — Phase 1 (fetching the correct 2026 admission PDFs) runs through it.

---

## Path A — Seoul server + tinyproxy (recommended, cheapest)

### Step 1 — Rent the Seoul server
1. Go to **vultr.com**, create an account, add a payment method (it may ask for a small ~$10 deposit).
2. Click **Deploy +** → **Deploy New Server**.
3. Choose:
   - **Type:** Cloud Compute – Shared CPU
   - **Location:** **Seoul** ← important
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** the cheapest one (about $5–6/mo, 1 CPU / 1 GB RAM)
   - **Auth:** the simplest is to let it **auto‑generate a password**
4. Click **Deploy**. Wait ~1 minute.
5. Open the server, and from its **Overview** page copy two things:
   - the **IP address** (looks like `141.164.x.x`)
   - the **root password** (click the eye icon to reveal it)

### Step 2 — Connect to the server
- **Windows:** on the server page click **View Console** (opens a black terminal in your browser).
  Log in: username `root`, then paste the password (right‑click to paste).
- **Mac / Linux:** open **Terminal** and run (replace with your IP):
  ```
  ssh root@YOUR_SERVER_IP
  ```
  Type `yes` if asked, then paste the password.

### Step 3 — Install the relay
Copy‑paste this one line and press Enter:
```
apt update && apt install -y tinyproxy
```

### Step 4 — Put a username + password on it
(So strangers/bots can't abuse your relay.)
Open the settings file:
```
nano /etc/tinyproxy/tinyproxy.conf
```
Make these three changes (use the arrow keys to move around):
1. Find the line `#BasicAuth user password` → remove the `#` and set your own, e.g.:
   ```
   BasicAuth hanguk ChangeThisToALongRandomPassword
   ```
2. Add this line anywhere (lets our changing GitHub IPs connect — the password still protects it):
   ```
   Allow 0.0.0.0/0
   ```
3. If you see a line `Listen 127.0.0.1`, put a `#` in front of it (so it listens to the internet, not just itself). If there's no such line, skip this.

Save and exit: press **Ctrl+O**, then **Enter**, then **Ctrl+X**.
Note the `Port` value (default is **8888**).

### Step 5 — Start it
```
systemctl restart tinyproxy
```

### Step 6 — Test that it works (from your OWN computer, not the server)
Replace the password/IP with yours:
```
curl -x http://hanguk:ChangeThisToALongRandomPassword@YOUR_SERVER_IP:8888 https://api.ipify.org
```
- If it prints an IP address that **starts with your Seoul server's IP**, it works. ✅
- (Bonus check that Korean sites open through it:)
  ```
  curl -x http://hanguk:ChangeThisToALongRandomPassword@YOUR_SERVER_IP:8888 -H "User-Agent: Mozilla/5.0" -I https://oia.korea.ac.kr/
  ```
  A `HTTP/… 200` near the top = Korean sites now open. ✅

### Step 7 — Hand it to the system
In GitHub: your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- **Name:** `UNI_DB_HTTP_PROXY`
- **Value:** `http://hanguk:ChangeThisToALongRandomPassword@YOUR_SERVER_IP:8888`
  (same string you tested, with your real password + IP)

### Step 8 — Tell Claude "proxy is ready"
Claude runs Phase 1 through it: fetch the correct 2026 PDFs, verify each one, set the official
links, then re‑extract + publish.

---

## Path B — No server at all (slightly pricier, zero Linux)
If you'd rather not touch a server: buy a **Korea proxy** from a service like **Webshare**
(webshare.io) or **IPRoyal** (iproyal.com). Choose **South Korea** as the location, and they give
you a ready connection string that looks like `http://username:password@host:port`. Paste that
straight into the `UNI_DB_HTTP_PROXY` secret (Step 7). Done — skip steps 1–6.

---

## Doing it for free

**Yes — two ways to pay $0 (or ~5 cents).**

### Free option 1 — Oracle Cloud "Always Free" Seoul server ($0 forever)
Oracle gives a small server in Korea free, permanently. Setup is the same as Path A, just on Oracle:
1. Sign up at **cloud.oracle.com/free**. During signup you must pick a **home region** —
   choose **South Korea Central (Seoul)** or **South Korea North (Chuncheon)**. ⚠️ This is
   permanent, so pick a Korean region. (A card is required for identity check; the Always‑Free
   resources are not charged.)
2. **Console → Compute → Instances → Create instance:**
   - Image: **Ubuntu 24.04** (Canonical Ubuntu)
   - Shape: pick one labeled **"Always Free eligible"** (e.g. **VM.Standard.E2.1.Micro**). If you
     see *"Out of host capacity"*, try the other shape/availability domain or retry later — this is
     the one annoyance of the free tier.
   - Add your SSH key; make sure it gets a **public IP**. Note that IP.
3. **Open the port (Oracle needs TWO firewall steps — this is the only extra bit vs Vultr):**
   - In the instance's **VCN → Security List**, add an **Ingress rule**: Source `0.0.0.0/0`,
     protocol **TCP**, destination port **8888**.
   - After you SSH in, also open it on the OS:
     ```
     sudo iptables -I INPUT 6 -p tcp --dport 8888 -j ACCEPT
     sudo apt install -y iptables-persistent && sudo netfilter-persistent save
     ```
4. Now follow **Steps 3–8** of Path A above (install tinyproxy, set BasicAuth + `Allow 0.0.0.0/0`,
   restart, test, add the `UNI_DB_HTTP_PROXY` secret). Done — $0/month.

### Free option 2 — "pennies": rent for an hour, then delete
Because we **store every PDF after fetching it, the proxy is only needed for the one ~1‑hour Phase‑1
run.** So: do Path A on Vultr, let Claude run the fetch, then **destroy the server**. Vultr bills by
the hour (~$0.009/hr), so the whole thing costs **about 1–5 cents**. Simplest if Oracle's free
capacity is being stubborn.

> Don't use "free public proxy lists" — they're unreliable, usually not Korean, and can spy on the
> traffic. Stick to one of the two options above.

## Notes
- **Keep the password private** — only ever paste it into the GitHub secret, never into code/chat.
- **It's only needed at fetch time.** Once we fetch each PDF, we store a copy, so re‑processing later
  doesn't need the proxy. You could even pause/destroy the server between fetch runs to save money.
- **SSH‑tunnel alternative:** if you'd prefer an SSH SOCKS5 tunnel instead of tinyproxy, tell Claude —
  it'll add a tunnel step to the GitHub workflow and you'd set `UNI_DB_HTTP_PROXY=socks5://…`.
- **If the test in Step 6 fails:** double‑check the password has no typo, the `Allow 0.0.0.0/0` line
  was added, and you restarted tinyproxy (Step 5). On Vultr there's usually no extra firewall to open.
