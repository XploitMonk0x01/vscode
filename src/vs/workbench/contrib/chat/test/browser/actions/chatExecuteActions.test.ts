/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable, DisposableStore, IDisposable } from '../../../../../../base/common/lifecycle.js';
import { Event } from '../../../../../../base/common/event.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { IChatWidget, IChatWidgetService } from '../../../browser/chat.js';
import { ChatAgentLocation } from '../../../common/constants.js';
import { registerChatExecuteActions } from '../../../browser/actions/chatExecuteActions.js';

class TestChatWidgetService implements IChatWidgetService {
	declare readonly _serviceBrand: undefined;
	readonly onDidAddWidget = Event.None;
	readonly onDidBackgroundSession = Event.None;
	readonly onDidChangeFocusedWidget = Event.None;
	readonly onDidChangeFocusedSession = Event.None;

	private _lastFocusedWidget: IChatWidget | undefined;
	public revealCalls: IChatWidget[] = [];

	constructor(lastFocusedWidget?: IChatWidget) {
		this._lastFocusedWidget = lastFocusedWidget;
	}

	get lastFocusedWidget(): IChatWidget | undefined {
		return this._lastFocusedWidget;
	}

	setLastFocusedWidget(widget: IChatWidget | undefined): void {
		this._lastFocusedWidget = widget;
	}

	getWidgetByInputUri(_uri: URI): IChatWidget | undefined {
		return undefined;
	}

	getWidgetBySessionResource(_sessionResource: URI): IChatWidget | undefined {
		return undefined;
	}

	getWidgetsByLocations(_location: ChatAgentLocation): ReadonlyArray<IChatWidget> {
		return [];
	}

	revealWidget(_preserveFocus?: boolean): Promise<IChatWidget | undefined> {
		return Promise.resolve(undefined);
	}

	async reveal(widget: IChatWidget, _preserveFocus?: boolean): Promise<boolean> {
		this.revealCalls.push(widget);
		return true;
	}

	getAllWidgets(): ReadonlyArray<IChatWidget> {
		return [];
	}

	openSession(_sessionResource: URI): Promise<IChatWidget | undefined> {
		return Promise.resolve(undefined);
	}

	register(_newWidget: IChatWidget): IDisposable {
		return Disposable.None;
	}
}

suite('Chat Execute Actions Context', () => {
	const store = new DisposableStore();
	let instantiationService: TestInstantiationService;
	let widgetService: TestChatWidgetService;

	let actionsRegistered = false;
	function ensureActionsRegistered(): void {
		if (!actionsRegistered) {
			registerChatExecuteActions();
			actionsRegistered = true;
		}
	}

	function createWidget(): IChatWidget {
		return {
			input: {
				switchToNextModel: () => { },
				openModelPicker: () => { },
				openChatSessionPicker: () => { },
			},
		} as unknown as IChatWidget;
	}

	setup(() => {
		ensureActionsRegistered();
		instantiationService = store.add(new TestInstantiationService());
		widgetService = new TestChatWidgetService();
		instantiationService.set(IChatWidgetService, widgetService);
	});

	teardown(() => {
		store.clear();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	test('open model picker action prefers widget from execute context', async () => {
		const fallbackWidget = createWidget();
		const contextWidget = createWidget();

		let fallbackOpened = 0;
		let contextOpened = 0;
		(fallbackWidget.input.openModelPicker as () => void) = () => fallbackOpened++;
		(contextWidget.input.openModelPicker as () => void) = () => contextOpened++;

		widgetService.setLastFocusedWidget(fallbackWidget);

		const command = CommandsRegistry.getCommand('workbench.action.chat.openModelPicker');
		assert.ok(command?.handler);

		await command!.handler(instantiationService, { widget: contextWidget });

		assert.strictEqual(contextOpened, 1, 'expected context widget to open model picker');
		assert.strictEqual(fallbackOpened, 0, 'expected fallback widget to not open model picker');
		assert.deepStrictEqual(widgetService.revealCalls, [contextWidget], 'expected reveal to target context widget');
	});

	test('switch to next model action prefers widget from execute context', () => {
		const fallbackWidget = createWidget();
		const contextWidget = createWidget();

		let fallbackSwitch = 0;
		let contextSwitch = 0;
		(fallbackWidget.input.switchToNextModel as () => void) = () => fallbackSwitch++;
		(contextWidget.input.switchToNextModel as () => void) = () => contextSwitch++;

		widgetService.setLastFocusedWidget(fallbackWidget);

		const command = CommandsRegistry.getCommand('workbench.action.chat.switchToNextModel');
		assert.ok(command?.handler);

		command!.handler(instantiationService, { widget: contextWidget });

		assert.strictEqual(contextSwitch, 1, 'expected context widget to switch model');
		assert.strictEqual(fallbackSwitch, 0, 'expected fallback widget to not switch model');
	});

	test('chat session primary picker action prefers widget from execute context', async () => {
		const fallbackWidget = createWidget();
		const contextWidget = createWidget();

		let fallbackOpened = 0;
		let contextOpened = 0;
		(fallbackWidget.input.openChatSessionPicker as () => void) = () => fallbackOpened++;
		(contextWidget.input.openChatSessionPicker as () => void) = () => contextOpened++;

		widgetService.setLastFocusedWidget(fallbackWidget);

		const command = CommandsRegistry.getCommand('workbench.action.chat.chatSessionPrimaryPicker');
		assert.ok(command?.handler);

		await command!.handler(instantiationService, { widget: contextWidget });

		assert.strictEqual(contextOpened, 1, 'expected context widget to open session picker');
		assert.strictEqual(fallbackOpened, 0, 'expected fallback widget to not open session picker');
	});
});
