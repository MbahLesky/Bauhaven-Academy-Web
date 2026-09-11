/**
 * A stand-in Supabase client for unit tests. Test-only: nothing outside `*.test.ts(x)`
 * imports it.
 *
 * Every `from()` call is recorded as one `RecordedOp` — which table, whether it read or
 * wrote, the payload, and each filter in order — and answered by the test's `respond`
 * function once the chain is awaited. Tests then assert on `ops`: what was written, with
 * which filters, and that nothing was written where nothing should be.
 */

export type WriteAction = "insert" | "upsert" | "update" | "delete";

export interface RecordedOp {
  table: string;
  action: "select" | WriteAction;
  /** The columns passed to `select()`, on a read. */
  columns: string | null;
  /** `select()`'s options on a read (`count`, `head`), or `upsert()`'s options on a write. */
  options: Record<string, unknown> | undefined;
  payload: unknown;
  /** `[method, ...args]` for each filter, modifier and `single`/`maybeSingle`, in call order. */
  filters: unknown[][];
}

export interface FakeResult {
  data?: unknown;
  count?: number | null;
  error?: { code?: string; message: string } | null;
}

export interface RecordedRpc {
  name: string;
  args: unknown;
}

const CHAIN_METHODS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is",
  "not",
  "or",
  "ilike",
  "order",
  "limit",
  "range",
  "single",
  "maybeSingle",
];

export function createFakeSupabase(
  respond: (op: RecordedOp) => FakeResult = () => ({}),
  respondRpc: (call: RecordedRpc) => FakeResult = () => ({})
) {
  const ops: RecordedOp[] = [];
  const rpcs: RecordedRpc[] = [];

  const client = {
    from(table: string) {
      const op: RecordedOp = { table, action: "select", columns: null, options: undefined, payload: undefined, filters: [] };
      ops.push(op);

      const builder: Record<string, unknown> = {
        select(columns?: string, options?: Record<string, unknown>) {
          // After a write, `select()` only asks for the written rows back.
          if (op.action === "select") {
            op.columns = columns ?? "*";
            op.options = options;
          }
          return builder;
        },
        insert(payload: unknown) {
          op.action = "insert";
          op.payload = payload;
          return builder;
        },
        upsert(payload: unknown, options?: Record<string, unknown>) {
          op.action = "upsert";
          op.payload = payload;
          op.options = options;
          return builder;
        },
        update(payload: unknown) {
          op.action = "update";
          op.payload = payload;
          return builder;
        },
        delete() {
          op.action = "delete";
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ data: null, count: null, error: null, ...respond(op) }).then(resolve, reject);
        },
      };

      for (const method of CHAIN_METHODS) {
        builder[method] = (...args: unknown[]) => {
          op.filters.push([method, ...args]);
          return builder;
        };
      }

      return builder;
    },
    rpc(name: string, args?: unknown) {
      const call = { name, args };
      rpcs.push(call);
      return Promise.resolve({ data: null, error: null, ...respondRpc(call) });
    },
  };

  return {
    client,
    ops,
    rpcs,
    /** Every write, in order. */
    writes: () => ops.filter((op) => op.action !== "select"),
    /** The value a filter was given, e.g. `filterValue(op, "eq", "id")`. */
    filterValue: (op: RecordedOp, method: string, column: string) =>
      op.filters.find((filter) => filter[0] === method && filter[1] === column)?.[2],
  };
}

/** Whether an op was made with a given filter, e.g. `hasFilter(op, "eq", "status", "open")`. */
export function hasFilter(op: RecordedOp, method: string, ...args: unknown[]): boolean {
  return op.filters.some(
    (filter) => filter[0] === method && args.every((arg, index) => JSON.stringify(filter[index + 1]) === JSON.stringify(arg))
  );
}
