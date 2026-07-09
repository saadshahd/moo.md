---
paths: "**/*.{ts,tsx}"
when: distributed
source: Helland
---
when: [distributed] · tier: standard · check: deterministic
What crosses a boundary is an explicit, versioned contract with a descriptive (self-describing) schema — never your internal relational/ORM entity leaked directly; consumers branch on the stated version rather than assuming the sender's "now" shape.
WRONG:
```ts
app.get('/orders/:id', async (req, res) =>
  res.json(await db.orders.findRaw(req.params.id)))   // internal row = public API
```
RIGHT:
```ts
type OrderV1 = { schema: 'order.v1'; id: string; total: Money; lines: LineV1[] }
const toContract = (row: OrderRow): OrderV1 => ({ schema: 'order.v1', /* explicit map */ })
app.get('/orders/:id', async (req, res) =>
  res.json(toContract(await Orders.get(req.params.id))))
```
_Avoid_: returning an ORM/DB entity or `findRaw`/`.toJSON()` of an internal model straight from a handler; a cross-boundary message/DTO type with no `schema`/`version`/`type` version tag; consumers reading a foreign message with no version branch.
Detect: an HTTP/queue handler serializing an internal persistence type without a mapping step; message/event type definitions lacking an explicit version discriminant; a consumer that destructures a foreign payload without checking its version.
Not-when: the type is used only inside one service's own boundary (inside-data), never serialized across a process/service/third-party edge.
