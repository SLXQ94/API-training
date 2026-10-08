# Commands for Lecture 1

Replace `localhost:3000` with the teacher's `http://<ip>:3000` when calling from another machine.
On Windows use **Git Bash** or WSL (cmd/PowerShell quoting breaks the JSON), or use Postman/Thunder Client.

Tip: add `-i` to any curl to see status code and headers; `| jq` (if installed) pretty-prints JSON.

## Step 1: health
```bash
curl localhost:3000/health
curl -i localhost:3000/nothing-here          # our JSON 404
```

## Step 2: users
```bash
# 2a register
curl -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"rollNo":"CS101","name":"Asha","password":"pass101"}'
curl -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"rollNo":"CS102","name":"Ravi","password":"pass102"}'
curl -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"rollNo":"CS103","name":"Meera","password":"pass103"}'

# things that should fail (show the status codes)
curl -i -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"rollNo":"CS101","name":"Again","password":"pass101"}'      # 409 duplicate
curl -i -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"rollNo":"x","name":"Bad","password":"pass"}'               # 400 invalid roll no
curl -i -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{this is not json'                                           # 400 invalid json

# 2b list, 2c lookup (case-insensitive roll no)
curl localhost:3000/users
curl localhost:3000/users/cs101
curl -i localhost:3000/users/NOPE                                  # 404
```
(Skip the registrations if you ran `npm run seed`.)

## Step 3: messages (no auth yet: we just tell the server who we are with ?user= or "from")
```bash
# 3a send: direct message, and to the whole class
curl -X POST localhost:3000/messages -H "Content-Type: application/json" \
  -d '{"from":"CS101","to":"CS102","text":"Hey Ravi, did you get the assignment?"}'
curl -X POST localhost:3000/messages -H "Content-Type: application/json" \
  -d '{"from":"CS102","to":"CS101","text":"Yes! Sending notes soon."}'
curl -X POST localhost:3000/messages -H "Content-Type: application/json" \
  -d '{"from":"CS103","to":"class","text":"Good morning everyone!"}'

# 3b read: everything visible to me
curl "localhost:3000/messages?user=CS102"
curl "localhost:3000/messages?user=CS102&with=CS101"               # one conversation
curl "localhost:3000/messages?user=CS102&with=class"               # group chat
curl "localhost:3000/messages?user=CS102&after=1"                  # only newer than id 1 (polling!)
curl "localhost:3000/messages?user=CS102&limit=1"                  # only the latest one

# 3c read one
curl "localhost:3000/messages/1?user=CS101"
curl -i "localhost:3000/messages/1?user=CS103"                     # 403: not your conversation
curl -i "localhost:3000/messages/999?user=CS101"                   # 404
```

## Step 4: edit and delete
```bash
curl -X PATCH localhost:3000/messages/1 -H "Content-Type: application/json" \
  -d '{"from":"CS101","text":"Hey Ravi, did you finish the assignment?"}'
curl -i -X PATCH localhost:3000/messages/1 -H "Content-Type: application/json" \
  -d '{"from":"CS102","text":"hacked"}'                            # 403: not your message
curl -i -X DELETE "localhost:3000/messages/2?user=CS102"           # 204 No Content
curl -i "localhost:3000/messages/2?user=CS102"                     # 404 now
```

## Pause: break it (no password anywhere!)
```bash
# CS103 sends a message pretending to be CS101
curl -X POST localhost:3000/messages -H "Content-Type: application/json" \
  -d '{"from":"CS101","to":"CS102","text":"I did not write this, CS103 did"}'
# anyone reads CS101's private inbox
curl "localhost:3000/messages?user=CS101"
```
Open `data/db.json` too: show students the whole "database" is a text file.

## Step 5: logger
Restart, repeat any command above, watch the terminal: method, URL, status, time.

## Step 6: password protection
Use `-u rollNo:password` (curl builds the `Authorization: Basic ...` header).
```bash
curl -i localhost:3000/messages                                    # 401, no credentials
curl -i -u CS101:wrong localhost:3000/messages                     # 401, wrong password
curl -u CS101:pass101 localhost:3000/me                            # who does the server think I am?
curl -u CS101:pass101 localhost:3000/messages

# the spoof from before now fails: "from" is ignored, the server uses the password's owner
curl -u CS103:pass103 -X POST localhost:3000/messages -H "Content-Type: application/json" \
  -d '{"from":"CS101","to":"CS102","text":"trying to impersonate"}'   # comes out as from CS103

# ?user= is ignored too: this is CS102's inbox, not CS101's
curl -u CS102:pass102 "localhost:3000/messages?user=CS101"

curl -u CS101:pass101 localhost:3000/users                         # list is protected now
curl -X POST localhost:3000/users -H "Content-Type: application/json" \
  -d '{"rollNo":"CS104","name":"Dev","password":"pass104"}'        # register stays open
```
In a browser, open `http://localhost:3000/messages`: the 401 pops up a login dialog.

## Step 7: global rate limit (10 requests / 10 s per IP)
```bash
# 13 quick calls: ten 200s, then 429s
for i in $(seq 1 13); do curl -s -o /dev/null -w "%{http_code} " localhost:3000/health; done; echo

curl -i localhost:3000/health          # look at X-RateLimit-* and Retry-After headers

# brute-force attempt: guessing passwords gets throttled as well
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code} " -u CS101:guess$i localhost:3000/messages; done; echo
```
Wait 10 seconds and it works again.

## Step 8: per-user send limit (3 messages / 10 s)
```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code} " -u CS101:pass101 -X POST localhost:3000/messages \
    -H "Content-Type: application/json" -d "{\"to\":\"CS102\",\"text\":\"spam $i\"}"
done; echo
```
Expected: `201 201 201 429 429`. CS102 can still send meanwhile: the limit is per person.

## Reset between demos
```bash
npm run reset      # empty database
npm run seed       # 3 demo users + 3 messages
```
