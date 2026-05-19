exports.up = async function(knex) {
  await knex.schema.createTable('procurement_receipts', (table) => {
    table.increments('id').primary();
    table.integer('procurement_item_id').unsigned().references('id').inTable('procurement_items').onDelete('CASCADE');
    table.datetime('received_date');
    table.integer('quantity_received');
    table.integer('admin_staff_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('procurement_receipts');
};
