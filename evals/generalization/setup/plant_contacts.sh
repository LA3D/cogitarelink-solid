#!/bin/bash
# Generalization probe — seed an OPERATION-shaped corpus into the live addressbook
# (/vault/contacts/). 6 vCard Individuals, each with a distinct ORCID (owl:sameAs),
# conforming to ContactCardShape (vcard:fn + vcard:inAddressBook + an owl:sameAs anchor).
# The contact-find-by-orcid affordance (SELECT ?person WHERE { ?person owl:sameAs $orcid })
# answers the task query; brute-force = GET all 6 and match. ORCIDs are SYNTHETIC so the
# name<->ORCID mapping exists ONLY in the Pod (forces a lookup, no training-set guess).
set -euo pipefail
POD="https://pod.vardeman.me"
P="$POD/vault/contacts/Person"
AB="$POD/vault/contacts/index.ttl#this"

put_contact() {  # <slug> <fn> <orcid-tail>
  curl -sk -o /dev/null -w "PUT $2: %{http_code}\n" -X PUT -H 'Content-Type: text/turtle' \
    "$P/$1.ttl" --data-binary @- <<TTL
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
<#this>
    a vcard:Individual ;
    vcard:fn "$2" ;
    vcard:inAddressBook <$AB> ;
    owl:sameAs <https://orcid.org/$3> .
TTL
}

put_contact gen-ada-lovelace      "Ada Lovelace"      0000-0001-0000-0001
put_contact gen-alan-turing       "Alan Turing"       0000-0001-0000-0002
put_contact gen-grace-hopper      "Grace Hopper"      0000-0001-0000-0003
put_contact gen-katherine-johnson "Katherine Johnson" 0000-0001-0000-0004
put_contact gen-claude-shannon    "Claude Shannon"    0000-0001-0000-0005
put_contact gen-dorothy-vaughan   "Dorothy Vaughan"   0000-0001-0000-0006

TARGET="0000-0001-0000-0005"   # → Claude Shannon (the answer)
echo "target ORCID: https://orcid.org/$TARGET  (expected answer: Claude Shannon)"

echo "verify:"
HIT=$(curl -sk "$P/gen-claude-shannon.ttl" | grep -c "$TARGET" || true)
N=$(for s in ada-lovelace alan-turing grace-hopper katherine-johnson claude-shannon dorothy-vaughan; do
      curl -sk -o /dev/null -w '%{http_code}\n' "$P/gen-$s.ttl"; done | grep -c '^200$' || true)
if [ "$HIT" -ge 1 ] && [ "$N" = "6" ]; then
  echo "  6/6 contacts live; target contact carries the ORCID — PROBE ARMED"
  exit 0
fi
echo "  NOT ARMED (target-hit=$HIT live=$N/6)"; exit 1
