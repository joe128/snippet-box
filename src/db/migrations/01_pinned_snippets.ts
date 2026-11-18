import { DataTypes, QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';
const { INTEGER } = DataTypes;

export const up: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('snippets', 'isPinned', {
    type: INTEGER,
    allowNull: true,
    defaultValue: 0
  });
};

export const down: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('snippets', 'isPinned');
};
