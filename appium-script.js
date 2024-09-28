import { remote } from 'webdriverio';
import { authenticator } from 'otplib';
import dotenv from 'dotenv';

dotenv.config();

const checkElementPresent = async (driver, selector) => {
    try {
        const element = await driver.$(selector);
        await element.waitForDisplayed({ timeout: 10000 });
        return element;
    } catch (err) {
        console.log(`Element with selector ${selector} not found.`);
        return null;
    }
};

// Function to perform an action with a delay (1 second)
const performActionWithDelay = async (driver, action, delay = 1000) => {
    await action();
    await driver.pause(delay);  // 1-second delay between actions
};

const scrollDown = async (driver) => {
    await driver.action('pointer')
        .move({ duration: 0, x: 640, y: 1595 })
        .down({ button: 0 })
        .move({ duration: 1000, x: 629, y: 26 })
        .up({ button: 0 })
        .perform();

    await driver.action('pointer')
        .move({ duration: 0, x: 553, y: 1480 })
        .down({ button: 0 })
        .move({ duration: 1000, x: 817, y: 386 })
        .up({ button: 0 })
        .perform();
};

async function runAppiumTest() {
    const appiumSessionConfigs = {
        path: '/',
        port: 4723,
        capabilities: {
            platformName: "Android",
            "appium:deviceName": "emulator-5554",
            "appium:app": process.env.APK_LOCATION,
            "appium:appPackage": "com.ea.gp.madden19companionapp",
            "appium:appActivity": ".MainActivity",
            "appium:automationName": "UiAutomator2",
            "appium:noReset": false,
            "appium:fullReset": true
        }
    };

    let success = false;

    const driver = await remote(appiumSessionConfigs);

    // Step 1: Click on "Manage Franchise"
    console.log('Clicking on MANAGE FRANCHISE');
    const manageFranchiseButton = await checkElementPresent(driver, '//android.view.View[@text="MANAGE FRANCHISE"]');
    if (manageFranchiseButton) {
        await performActionWithDelay(driver, () => manageFranchiseButton.click());

        // Step 2: Check for login requirement
        const loginElement = await checkElementPresent(driver, '//*[@resource-id="loginWithOriginIDTitle"]');
        if (loginElement) {
            console.log("Login required. Proceeding with login.");

            // Step 3: Perform login
            const emailField = await checkElementPresent(driver, '//android.widget.EditText[@resource-id="email"]');
            const passwordField = await checkElementPresent(driver, '//android.widget.EditText[@resource-id="password"]');
            const loginButton = await checkElementPresent(driver, '//android.widget.Button[@resource-id="logInBtn"]');

            if (emailField && passwordField && loginButton) {
                await performActionWithDelay(driver, () => emailField.setValue(process.env.EA_EMAIL));
                await performActionWithDelay(driver, () => passwordField.setValue(process.env.EA_PASSWORD));
                await performActionWithDelay(driver, () => loginButton.click(), 1500);

                // Handle 2FA if needed
                const appBased2FA = await checkElementPresent(driver, '//android.view.View[@resource-id="APPLabel"]');
                if (appBased2FA) {
                    console.log('Clicking "App based 2FA"');
                    await performActionWithDelay(driver, () => appBased2FA.click());
                    const sendCodeButton = await checkElementPresent(driver, '//android.widget.Button[@resource-id="btnSendCode"]');
                    if (sendCodeButton) {
                        await performActionWithDelay(driver, () => sendCodeButton.click(), 1500);

                        const twoFactorField = await checkElementPresent(driver, '//android.widget.EditText[@resource-id="twoFactorCode"]');
                        const submitButton = await checkElementPresent(driver, '//android.widget.Button[@resource-id="btnSubmit"]');

                        if (twoFactorField && submitButton) {
                            await performActionWithDelay(driver, () => twoFactorField.setValue(authenticator.generate(process.env.AUTHENTICATOR_SECRET)));
                            await performActionWithDelay(driver, () => submitButton.click(), 1500);
                            console.log("Login successful. Proceeding with the next steps.");
                        }
                    }
                } else {
                    console.log("No login required. Proceeding with the next steps.");
                }
            }
        }

        // Step 4: Select Persona
        const pickPersonaElement = await checkElementPresent(driver, '//*[@text="PICK YOUR PERSONA"]');
        if (pickPersonaElement) {
            console.log('Found PICK YOUR PERSONA');
            const siblingParents = await driver.$$('//*[@text="PICK YOUR PERSONA"]/following-sibling::*');
            console.log('Siblings:', siblingParents.length);

            for (const sibling of siblingParents) {
                const playstationElement = await sibling.$('//*[@text="Playstation 5"]');
                if (await playstationElement.isDisplayed()) {
                    console.log("Found 'Playstation 5'. Clicking.");
                    await performActionWithDelay(driver, () => sibling.click(), 3000);
                    break;
                }
            }
        }

        // Step 5: Select OPM Season
        const opmSeasonElement = await checkElementPresent(driver, "//*[contains(@text, 'OPMSeason')]");
        if (opmSeasonElement) {
            await performActionWithDelay(driver, () => opmSeasonElement.click(), 2000);
        }

        // Step 6: Export data
        const exportsButton = await checkElementPresent(driver, '//android.widget.Button[@text="EXPORTS"]');
        if (exportsButton) {
            await performActionWithDelay(driver, () => exportsButton.click());

            const urlField = await checkElementPresent(driver, '//android.widget.EditText');
            if (urlField) {
                await performActionWithDelay(driver, () => urlField.setValue('https://neonsportz.com/api/leagues/OPM/import'));
                const rostersButton = await checkElementPresent(driver, '//android.view.View[contains(@text, "ROSTERS")]');
                const weekButton = await checkElementPresent(driver, '//android.widget.Button[@text="Preseason Week 1"]');

                if (rostersButton && weekButton) {
                    await performActionWithDelay(driver, () => rostersButton.click());
                    await performActionWithDelay(driver, () => weekButton.click());

                    await scrollDown(driver);
                    await driver.pause(1000);
                    await performActionWithDelay(driver, () => driver.$('//*[@text="ALL WEEKS"]').click());
                    await performActionWithDelay(driver, () => driver.$('//*[contains(@text, "EXPORT (")]').click(), 15000);
                    if (await checkElementPresent(driver, '//android.view.View[@text="EXPORT SUCCEDED"]')) {
                        success = true;
                        console.log('Data exported successfully.');
                    }
                }
            }
        }
    }

    await driver.deleteSession();
    return success;
}

runAppiumTest()
    .then((success) => {
        console.log(success ? 'SUCCESS' : 'FAILED');
        if (success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }).catch((err) => {
        console.error('Error occurred:', err);
        process.exit(1);
    });