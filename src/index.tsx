import { useEffect, useReducer, Dispatch, useRef } from 'react';

type Transition<C> =
  | string
  | {
      target: string;
      guard?: (context: C) => boolean;
    };

type KeysOfTransition<Obj> = Obj extends { on: { [key: string]: Transition<any> } } ? keyof Obj['on'] : never;

interface BaseStateConfig<C> {
  on?: {
    [key: string]: Transition<C>;
  };
}

type ContextUpdater<C> = (updater: (context: C) => C) => void;

interface MachineStateConfig<C> extends BaseStateConfig<C> {
  effect?: (
    send: Dispatch<string>,
    assign: ContextUpdater<C>
  ) => void | ((send: Dispatch<string>, assign: ContextUpdater<C>) => void);
}

interface MachineConfig<C> {
  initial: string;
  debug?: boolean;
  states: {
    [key: string]: MachineStateConfig<C>;
  };
}

const __contextKey = Symbol('CONTEXT');

const getReducer = <
  Context extends Record<PropertyKey, any>,
  Config extends MachineConfig<Context>,
  State extends keyof Config['states'],
  Event extends KeysOfTransition<Config['states'][keyof Config['states']]>
>(
  config: Config
) =>
  function reducer(
    state: {
      value: State;
      context: Context;
      nextEvents: Event[];
    },
    event: Event | { type: typeof __contextKey; updater: (context: Context) => Context }
  ) {
    type IndexableState = keyof typeof config.states;
    const currentState = config.states[state.value as IndexableState];
    const nextState = currentState?.on?.[event as IndexableState];

    // Internal action to update context
    if (typeof event === 'object' && event.type === __contextKey) {
      const nextContext = event.updater(state.context);

      if (process.env.NODE_ENV === 'development') {
        if (config.debug)
          console.log(
            '%cuseStateMachine ' + `%cContext update from %o to %o`,
            'color: #888;',
            'color: default;',
            state.context,
            nextContext
          );
      }
      return {
        ...state,
        context: nextContext,
      };
    }

    // If there is no defined next state, return early
    if (!nextState) {
      if (process.env.NODE_ENV === 'development') {
        if (config.debug)
          console.log(
            '%cuseStateMachine ' + `%cCurrent state %o doesn't listen to event ${event}.`,
            'color: #888;',
            'color: default;',
            state
          );
      }

      return state;
    }

    const nextStateValue = typeof nextState === 'string' ? nextState : nextState.target;

    // If there are guards, invoke them and return early if the transition is denied
    if (typeof nextState === 'object' && nextState.guard && !nextState.guard(state.context)) {
      if (process.env.NODE_ENV === 'development') {
        if (config.debug)
          console.log(
            '%cuseStateMachine ' + `%cTransition from ${state.value} to ${nextStateValue} denied by guard`,
            'color: #888;',
            'color: default;'
          );
      }
      return state;
    } else {
      if (process.env.NODE_ENV === 'development') {
        if (config.debug)
          console.log(
            '%cuseStateMachine ' + `%cTransition from ${state.value} to ${nextStateValue}`,
            'color: #888;',
            'color: default;'
          );
      }
    }

    return {
      ...state,
      value: nextStateValue as State,
      nextEvents: Object.keys(config.states[nextStateValue].on ?? []) as Event[],
    };
  };

const useConstant = <T,>(init: () => T) => {
  const ref = useRef<T | null>(null);

  if (ref.current === null) {
    ref.current = init();
  }
  return ref.current;
};

export default function useStateMachine<Context extends Record<PropertyKey, any>>(context?: Context) {
  return function useStateMachineWithContext<Config extends MachineConfig<Context>>(config: Config) {
    type IndexableState = keyof typeof config.states;
    type State = keyof Config['states'];
    type Event = KeysOfTransition<Config['states'][keyof Config['states']]>;

    const initialState = useConstant(() => ({
      value: config.initial as State,
      context: context ?? ({} as Context),
      nextEvents: Object.keys(config.states[config.initial].on ?? []) as Event[],
    }));

    const reducer = useConstant(() => getReducer<Context, Config, State, Event>(config));

    const [machine, send] = useReducer(reducer, initialState);

    // The updater function sends an internal event to the reducer to trigger the actual update
    const update = (updater: (context: Context) => Context) =>
      send({
        type: __contextKey,
        updater,
      });

    useEffect(() => {
      const exit = config.states[machine.value as IndexableState]?.effect?.(send as Dispatch<string>, update);
      return typeof exit === 'function' ? exit.bind(null, send as Dispatch<string>, update) : void 0;
    }, [machine.value]);

    return [machine, send] as [
      {
        value: State;
        context: Context;
        nextEvents: Event[];
      },
      Dispatch<Event>
    ];
  };
}
