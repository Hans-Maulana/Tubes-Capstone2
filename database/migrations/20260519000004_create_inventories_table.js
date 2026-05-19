exports.up = async function(knex) {
  await knex.schema.createTable('inventories', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('category');
    table.date('purchase_date');
    table.integer('price');
    table.enum('condition', ['Baik', 'Rusak', 'Maintenance']).defaultTo('Baik');
    table.integer('room_id').unsigned().references('id').inTable('rooms').onDelete('SET NULL');
    table.string('label_number').unique();
    table.string('qr_image_path');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('inventories');
};
