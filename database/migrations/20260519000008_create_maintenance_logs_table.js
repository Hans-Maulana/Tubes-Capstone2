exports.up = async function(knex) {
  await knex.schema.createTable('maintenance_logs', (table) => {
    table.increments('id').primary();
    table.integer('inventory_id').unsigned().references('id').inTable('inventories').onDelete('CASCADE');
    table.integer('staff_lab_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.text('description');
    table.datetime('date');
    table.integer('bhp_used_id').unsigned().references('id').inTable('bhps').onDelete('SET NULL');
    table.integer('bhp_quantity_used');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('maintenance_logs');
};
