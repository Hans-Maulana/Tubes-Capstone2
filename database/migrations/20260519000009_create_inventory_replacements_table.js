exports.up = async function(knex) {
  await knex.schema.createTable('inventory_replacements', (table) => {
    table.increments('id').primary();
    table.integer('old_inventory_id').unsigned().references('id').inTable('inventories').onDelete('CASCADE');
    table.integer('new_inventory_id').unsigned().references('id').inTable('inventories').onDelete('SET NULL');
    table.datetime('date');
    table.text('reason');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('inventory_replacements');
};
