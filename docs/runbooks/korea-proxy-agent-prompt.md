# Prompt to paste into a Claude that has terminal access (Claude Code / extension)

Copy everything in the fenced block below and give it to your local Claude (one with a
terminal). It sets up the Seoul proxy and stores it as the GitHub secret. You only do the
Vultr signup/payment in the browser; the agent does the rest.

```
You're setting up a small HTTP proxy located in SEOUL, SOUTH KOREA so a web crawler can reach
Korean university sites (.ac.kr) that block non-Korean IPs. End goal: store the proxy URL as a
GitHub Actions secret named UNI_DB_HTTP_PROXY in the repo asrbekshokirovich-bot/hanguk-uz.

We'll use tinyproxy on a cheap Vultr server in Seoul, protected by a username + password.
I (the human) will do any signup/payment in the browser; you do the terminal setup and testing.

Steps:

1) If there's no Seoul server yet, tell me to create one and wait for me:
   vultr.com -> Deploy New Server -> Cloud Compute (Shared CPU) -> Location: Seoul ->
   Ubuntu 24.04 LTS -> cheapest plan -> auto-generate password -> Deploy.
   Then ask me for the server's PUBLIC IP and ROOT PASSWORD.

2) SSH in:  ssh root@<IP>   (use the password I give you)

3) Install + configure tinyproxy:
   - apt update && apt install -y tinyproxy
   - Generate a strong password:  openssl rand -hex 16   (use username: hanguk)
   - Edit /etc/tinyproxy/tinyproxy.conf and:
       * set:  BasicAuth hanguk <THE_GENERATED_PASSWORD>
       * add a line:  Allow 0.0.0.0/0
       * if a line "Listen 127.0.0.1" exists, comment it out with a #
       * keep Port 8888
   - systemctl restart tinyproxy

4) Test it works:
   curl -x "http://hanguk:<PASSWORD>@<IP>:8888" https://api.ipify.org
     -> must print the Seoul server's IP.
   curl -x "http://hanguk:<PASSWORD>@<IP>:8888" -H "User-Agent: Mozilla/5.0" -I https://oia.korea.ac.kr/
     -> expect "HTTP/.. 200" near the top (Korean site opens through it).
   If either fails, fix the config (Allow line / restart / password typo) and retry.

5) Build the proxy URL:  http://hanguk:<PASSWORD>@<IP>:8888

6) Store it as the GitHub secret:
   - If you have the gh CLI and it's authenticated:
       printf '%s' "http://hanguk:<PASSWORD>@<IP>:8888" | gh secret set UNI_DB_HTTP_PROXY -R asrbekshokirovich-bot/hanguk-uz
   - Otherwise tell me to add it manually: GitHub -> the repo -> Settings ->
     Secrets and variables -> Actions -> New repository secret ->
     Name: UNI_DB_HTTP_PROXY   Value: the proxy URL above.

7) Report back: the server IP, that BOTH curl tests passed, and that the secret is set.
   Do NOT print the password in your final summary (keep it only inside the commands).

Security: never commit the password anywhere; it lives only in the tinyproxy config and the
GitHub secret. The proxy is only needed during the one-time fetch, so I may destroy the server
afterward to keep it free.
```
