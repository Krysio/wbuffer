import TestRunner, { TestRunnerContext } from 'jest-runner';
import { Config } from '@jest/types';
import { exec } from 'child_process';

export default class MocketTestRunner extends TestRunner {
    constructor(globalConfig: Config.GlobalConfig, context: TestRunnerContext) {
        super(globalConfig, context);

        let isFailure = false;
        let fileCounter = 0;

        this.on('test-file-failure', function listener() {
            isFailure = true;
        });
        this.on('test-file-start', function listener() {
            fileCounter++;
        });
        this.on('test-file-success', function listener([test, result]) {
            fileCounter--;

            if (result.numFailingTests) {
                isFailure = true;
            }

            if ((globalConfig.watch || globalConfig.watchAll) && fileCounter === 0 && isFailure === false) {
                exec('npm run build', (err, stdout, stderr) => {
                    if (err) {
                        console.error(err);
                        console.log(stderr);
                    }
    
                    console.log(stdout);
                });
            }
        });
    }
}
