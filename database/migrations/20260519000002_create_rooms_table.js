exports.up = async function(knex) {
  await knex.schema.createTable('rooms', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('location');
    table.text('description');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('rooms');
};
