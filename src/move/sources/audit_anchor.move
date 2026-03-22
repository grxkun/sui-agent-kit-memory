module agent_memory::audit_anchor {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use std::string::String;

    public struct AuditAnchor has key, store {
        id: UID,
        agent: address,
        latest_blob_id: String,
        latest_seq: u64,
        total_entries: u64,
    }

    public fun create(ctx: &mut TxContext): AuditAnchor {
        AuditAnchor {
            id: object::new(ctx),
            agent: tx_context::sender(ctx),
            latest_blob_id: std::string::utf8(b""),
            latest_seq: 0,
            total_entries: 0,
        }
    }

    public fun update(anchor: &mut AuditAnchor, new_blob_id: String, ctx: &TxContext) {
        assert!(anchor.agent == tx_context::sender(ctx), 0);
        anchor.latest_blob_id = new_blob_id;
        anchor.latest_seq = anchor.latest_seq + 1;
        anchor.total_entries = anchor.total_entries + 1;
    }

    public fun latest_blob_id(a: &AuditAnchor): &String { &a.latest_blob_id }
    public fun latest_seq(a: &AuditAnchor): u64 { a.latest_seq }
}
