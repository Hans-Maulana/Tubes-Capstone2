exports.up = async function(knex) {
  await knex.schema.createTable('procurement_items', (table) => {
    table.increments('id').primary();
    table.integer('draft_id').unsigned().references('id').inTable('procurement_drafts').onDelete('CASCADE');
    table.string('item_type');
    table.string('item_name');
    table.integer('quantity');
    table.integer('price');
    table.string('purchase_link');
    table.integer('replacement_inventory_id').unsigned().references('id').inTable('inventories').onDelete('SET NULL');
    table.string('status');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('procurement_items');
};
