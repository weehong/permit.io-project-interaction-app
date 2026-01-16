import chalk from 'chalk';

export const logger = {
  info: (message) => {
    console.log(chalk.blue('[INFO]'), message);
  },

  success: (message) => {
    console.log(chalk.green('[SUCCESS]'), message);
  },

  warning: (message) => {
    console.log(chalk.yellow('[WARNING]'), message);
  },

  error: (message) => {
    console.log(chalk.red('[ERROR]'), message);
  },

  blank: () => {
    console.log('');
  },

  header: (title) => {
    console.log('');
    console.log('='.repeat(46));
    console.log(`  ${title}`);
    console.log('='.repeat(46));
    console.log('');
  },

  divider: () => {
    console.log('-'.repeat(46));
  },
};
