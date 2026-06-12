#!/bin/bash
# SP2-T13 e2e walk — fixture plant + leg verification.
# Q1 (wiki leg) uses DEPLOYED state: photosynthesis.md skos:broader -> biology.md#this,
# no open action (clean cell — "current" is the ground truth). Nothing to plant; verify only.
# Q2 (addressbook leg) plants 6 synthetic vCard contacts (name<->ORCID mapping exists ONLY
# in the Pod). SP2 write contract: ContactCardShape now REQUIRES mem:rationale (MinCount 1),
# so the plant carries it — the old generalization plant 422s on a fresh SP2 pod.
set -euo pipefail
POD="https://pod.vardeman.me"
P="$POD/vault/contacts/Person"
AB="$POD/vault/contacts/index.ttl#this"

put_contact() {  # <slug> <fn> <orcid-tail>
  curl -sk -o /dev/null -w "PUT $2: %{http_code}\n" -X PUT -H 'Content-Type: text/turtle' \
    "$P/$1.ttl" --data-binary @- <<TTL
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix mem:   <https://pod.vardeman.me/vault/ontology/mem#> .
<#this>
    a vcard:Individual ;
    vcard:fn "$2" ;
    vcard:inAddressBook <$AB> ;
    owl:sameAs <https://orcid.org/$3> ;
    mem:rationale "Seeded by the e2e-walk eval rig (SP2-T13 fixture): synthetic reference contact planted by the Pod owner so the name-to-ORCID mapping exists only in this Pod; consulted ContactCardShape + the prior generalization-probe fixture." .
TTL
}

put_contact gen-ada-lovelace      "Ada Lovelace"      0000-0001-0000-0001
put_contact gen-alan-turing       "Alan Turing"       0000-0001-0000-0002
put_contact gen-grace-hopper      "Grace Hopper"      0000-0001-0000-0003
put_contact gen-katherine-johnson "Katherine Johnson" 0000-0001-0000-0004
put_contact gen-claude-shannon    "Claude Shannon"    0000-0001-0000-0005
put_contact gen-dorothy-vaughan   "Dorothy Vaughan"   0000-0001-0000-0006

TARGET="0000-0001-0000-0005"   # → Claude Shannon (the Q2 answer)
echo "Q2 target ORCID: https://orcid.org/$TARGET  (expected answer: Claude Shannon)"

echo "verify:"
HIT=$(curl -sk "$P/gen-claude-shannon.ttl" | grep -c "$TARGET" || true)
N=$(for s in ada-lovelace alan-turing grace-hopper katherine-johnson claude-shannon dorothy-vaughan; do
      curl -sk -o /dev/null -w '%{http_code}\n' "$P/gen-$s.ttl"; done | grep -c '^200$' || true)
BROADER=$(curl -sk "$POD/vault/wiki/concepts/photosynthesis.md.meta" | grep -c 'broader> <biology.md#this>' || true)
IDX=$(curl -sk "$POD/vault/wiki/concepts/index.md" | grep -c 'Photosynthesis' || true)
OPEN=$(curl -sk "$POD/vault/wiki/concepts/photosynthesis.md.meta" | grep -c 'hasOpenAction' || true)
if [ "$HIT" -ge 1 ] && [ "$N" = "6" ] && [ "$BROADER" -ge 1 ] && [ "$IDX" -ge 1 ] && [ "$OPEN" = "0" ]; then
  echo "  Q2: 6/6 contacts live, target carries the ORCID"
  echo "  Q1: photosynthesis broader=biology in .meta, listed in index.md, NO open action (clean cell)"
  echo "  PROBE ARMED"
  exit 0
fi
echo "  NOT ARMED (q2-hit=$HIT live=$N/6 broader=$BROADER idx=$IDX open=$OPEN)"; exit 1
