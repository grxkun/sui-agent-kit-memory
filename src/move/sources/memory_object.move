module agent_memory::memory_object {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::string::String;

    public struct MemoryObject has key {
        id: UID,
        hot_state: vector<u8>,
        state_blob_id: String,
        version: u64,
        updated_by: address,
        updated_at_ms: u64,
    }

    public fun create(ctx: &mut TxContext) {
        transfer::share_object(MemoryObject {
            id: object::new(ctx),
            hot_state: b"{}",
            state_blob_id: std::string::utf8(b""),
            version: 0,
            updated_by: tx_context::sender(ctx),
            updated_at_ms: 0,
        });
    }

    public fun update_hot_state(obj: &mut MemoryObject, new_state: vector<u8>, timestamp_ms: u64, ctx: &TxContext) {
        assert!(vector::length(&new_state) <= 16_384, 0);
        obj.hot_state = new_state;
        obj.version = obj.version + 1;
        obj.updated_by = tx_context::sender(ctx);
        obj.updated_at_ms = timestamp_ms;
    }

    public fun update_state_blob_id(obj: &mut MemoryObject, blob_id: String, ctx: &TxContext) {
        obj.state_blob_id = blob_id;
        obj.version = obj.version + 1;
        obj.updated_by = tx_context::sender(ctx);
    }

    public fun version(obj: &MemoryObject): u64 { obj.version }
    public fun hot_state(obj: &MemoryObject): &vector<u8> { &obj.hot_state }
    public fun state_blob_id(obj: &MemoryObject): &String { &obj.state_blob_id }
}
