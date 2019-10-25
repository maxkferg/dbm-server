"""
Train an agent on SeekerSimEnv

# For a lightweight test
python train.py configs/seeker-test.yaml --dev

# For a development td3 test
python train.py configs/seeker-td3.yaml --headless

# For a GPU driven large test
python train.py configs/seeker-apex-td3.yaml
python train.py configs/simple/simple-td3.yaml --headless

# Population based training
python train.py configs/seeker-apex-pbt.yaml --pbt
"""
import io
import ray
import yaml
import numpy as np
import gym
import math
import random
import logging
import argparse
import tensorflow as tf
import colored_traceback
from random import choice
from pprint import pprint
from gym.spaces import Discrete, Box
from gym.envs.registration import EnvSpec
from gym.envs.registration import registry
from ray import tune
from ray.tune import run, sample_from, run_experiments
from ray.tune.schedulers import PopulationBasedTraining
from ray.tune.registry import register_env
from ray.rllib.models import ModelCatalog
from learning.mink import MinkModel
from learning.simple import SimpleModel
from learning.preprocessing import DictFlatteningPreprocessor
from environment.loaders.geometry import GeometryLoader
from environment.env.base import BaseEnvironment # Env type
from environment.env.multi import MultiEnvironment # Env type
colored_traceback.add_hook()


ENVIRONMENT = "MultiRobot-v0"

# Only show errors and warnings
logging.basicConfig(format='%(asctime)s - %(message)s', datefmt='%d-%b-%y %H:%M:%S', level=logging.WARN)


# Print available tensorflow devices
with tf.Session() as sess:
    print("Tensorflow devices:", sess.list_devices())




def train_env_factory(args):
    """
    Create an environment that is linked to the communication platform
    @env_config: Environment configuration from config file
    @args: Command line arguments for overriding defaults
    """
    with open('environment/configs/prod.yaml') as cfg:
        api_config = yaml.load(cfg, Loader=yaml.Loader)
        api_config['building_id'] = '5d984a7c6f1886dacf9c730d'

    def train_env(cfg):
        if args.headless:
            cfg.headless = True
        loader = GeometryLoader(api_config) # Handles HTTP
        base = BaseEnvironment(loader, headless=cfg["headless"])
        return MultiEnvironment(base, verbosity=0, creation_delay=10, env_config=cfg)

    return train_env



def create_parser():
    parser = argparse.ArgumentParser(
        description='Process some integers.')
    parser.add_argument(
        "config",
        default="configs/seeker-test.yaml",
        type=str,
        help="The configuration file to use for the RL agent.")
    parser.add_argument(
        "--pbt",
        default=False,
        action="store_true",
        help="Run population based training.")
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Use development cluster with local redis server")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Hide any GUI windows")
    return parser



def run(args):
    ModelCatalog.register_custom_model("mink", MinkModel)
    ModelCatalog.register_custom_model("simple", SimpleModel)
    register_env(ENVIRONMENT, train_env_factory(args))

    with open(args.config, 'r') as stream:
        experiments = yaml.load(stream, Loader=yaml.Loader)

    for experiment_name, settings in experiments.items():
        print("Running %s"%experiment_name)
        ray.tune.run(
            settings['run'],
            name=experiment_name,
            stop=settings['stop'],
            config=settings['config'],
            checkpoint_freq=settings['checkpoint_freq'],
            queue_trials=True,
        )

def log_uniform(max, min):
    """
    log_uniform(1e-2, 1e-5)
    """
    min_exp = math.log10(min)
    max_exp = math.log10(max)
    exp = random.uniform(min_exp, max_exp)
    return 10**exp



def run_pbt(args):
    ModelCatalog.register_custom_model("mink", MinkModel)
    register_env(ENVIRONMENT, lambda cfg: train_env_creator(cfg))

    def get_batch_mode(spec):
        print(spec)
        if spec['config']['parameter_noise']:
            return 'complete_episodes'
        else:
            return 'truncate_episodes'

    pbt_scheduler = PopulationBasedTraining(
        time_attr='time_total_s',
        metric="episode_reward_mean",
        mode="max",
        perturbation_interval=1200.0,
        hyperparam_mutations={
            "lr": lambda: log_uniform(1e-3, 1e-5),
            "tau": lambda: random.uniform(0.001, 0.002),
            "target_network_update_freq": lambda: random.randint(50000, 200000),
            "exploration_ou_noise_scale": lambda: random.uniform(0.01, 0.2),
            "train_batch_size": lambda: random.randint(128, 1024),
            "buffer_size": lambda: random.randint(128000, 512000),
            "l2_reg": lambda: log_uniform(1e-5, 1e-8),
        })

    # Prepare the default settings
    with open(args.config, 'r') as stream:
        experiments = yaml.load(stream, Loader=yaml.Loader)

    for experiment_name, settings in experiments.items():
        print("Running %s"%experiment_name)
        settings['config'].update({
            "parameter_noise": sample_from(
                lambda spec: random.choice([True, False])),
            "target_network_update_freq": sample_from(
                lambda spec: random.randint(20000, 80000)),
            "train_batch_size": sample_from(
                lambda spec: random.choice([64, 256, 512, 1024])),
            "batch_mode": sample_from(
                lambda spec: get_batch_mode(spec)),
        })

        ray.tune.run(
            settings['run'],
            name=experiment_name,
            scheduler=pbt_scheduler,
            config=settings['config'],
            checkpoint_freq=20,
            max_failures=5,
            num_samples=6
        )


if __name__ == "__main__":
    parser = create_parser()
    args = parser.parse_args()
    if args.dev:
        ray.init()
    else:
        ray.init("localhost:6379")
    if args.pbt:
        run_pbt(args)
    else:
        run(args)
