exports.up = async function(knex) {
  await knex.schema.createTable('bhps', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('unit').notNullable();
    table.integer('stock').defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('bhps');
};
