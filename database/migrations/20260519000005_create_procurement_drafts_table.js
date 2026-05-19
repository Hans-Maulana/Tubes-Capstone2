exports.up = async function(knex) {
  await knex.schema.createTable('procurement_drafts', (table) => {
    table.increments('id').primary();
    table.integer('lab_head_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('year');
    table.enum('status', ['Draft', 'Submitted', 'Approved', 'Rejected', 'Locked']).defaultTo('Draft');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('procurement_drafts');
};
