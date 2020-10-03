---
layout: post.11ty.js
title: SSH for Github
date: 2020-10-03
tags: post
snippet: One of the hassles with <a href="https://git-scm.com/" target="_blank" rel="noopener">git</a> in the terminal is authorization/authentication for various commands
---

<div class="post-body">

One of the hassles with <a href="https://git-scm.com/" target="_blank" rel="noopener">`git`</a> in the terminal is authorization/authentication for various commands: `git pull/push/commit...`. Luckily, by using SSH instead of HTTPS bypasses the need to enter a user/password for any auth'ed action.

Setting up SSH for a git repo is simple enough:

1. Find out what remote urls are being used (also usable for bitbucket.org):
   ```
   $ git remote -v
   > origin https://github.com/USER/REPO.git (fetch)
   > origin https://github.com/USER/REPO.git (push)
   ```
2. Set the remote for SSH:
   ```
   $ git remote set-url origin git@github.com:USER/REPO.git
   # Verify new remote URL
   > origin origin git@github.com:USER/REPO.git (fetch)
   > origin origin git@github.com:USER/REPO.git (push)
   ```
3. Verify endpoints were updated by rerunning `git remote -v`.

Now that git has been set up to use SSH, there needs to be an ssh key.

1. Run the key generator for an <a href="https://simple.wikipedia.org/wiki/RSA_algorithm" target="_blank" rel="noopener">RSA</a> encrypted algorithm (by default the private/public key pair will be save in /home/USER/.ssh):
   ```
   $ ssh-keygen -t rsa
   ```
2. Copy the contents of the new `.pub` file (the public key).
3. Go the profile page at github.com and go to _Settings_ -> _SSH and GPG Keys_.
4. Click _New SSH Key_, paste the contents into **Key** and give it a title.

Even though github has the public key and is using the SSH remote URL, it's still not enough to use SSH quite yet.

1. Check to see if `ssh-agent` is a running process using <a href="https://man7.org/linux/man-pages/man1/ps.1.html" target="_blank" rel="noopener">`ps`</a> and <a href="https://man7.org/linux/man-pages/man1/grep.1.html" target="_blank" rel="noopener">`grep`</a>:
   ```
   $ ps aux | grep "ssh-agent"
   ```
2. The new private key needs to be added to `ssh-agent`:
   - If no current `ssh-agent` exists, start it (calling `eval` captures any shell environment variables):
     ```
     $ eval `ssh-agent -s`
     ```
   - Otherwise continue by adding the _private_ key to the agent and confirm by listing current keys:
     ```
     $ ssh-add /home/[USER]/.ssh/id_rsa
     $ ssh-add -l
     ```

Great, now any auth'ed git action will use the new SSH key, eliminating the hassle of using the password.

#### WSL Addendum

While using the <a href="https://docs.microsoft.com/en-us/windows/wsl/" title="Windows Subsystem for Linux" target="_blank" rel="noopener">WSL2</a>, each terminal window is treated as a separate login. This means that a new `ssh-agent` has to be created in order to make use of SSH keys for the `git` workflow. This makes using multiple terminal windows in <a target="_blank" rel="noopener" href="https://code.visualstudio.com/">Visual Studio Code</a> (or in any other program) a serious annoyance.

A simple way to deal with this hassle is to use <a href="https://linux.die.net/man/1/keychain" target="_blank" rel="noopener">`keychain`</a>, which allows sharing the `ssh-agent` between logins.

With a WSL terminal open (assuming an Ubuntu/Debian distribution):

1. Install keychain:
   ```
   $ sudo apt-get install keychain
   ```
2. Verify that values exist for the `HOME` and `HOSTNAME` environment variables:
   ```
   $ echo $HOST
   $ echo $HOSTNAME
   ```
3. In the home directory (`/home/[USER]`), open either `.bashrc` or `.bash_profile` in a text editor and add the following:
   ```
   keychain $HOME/.ssh/id_rsa
   source $HOME/.keychain/$HOSTNAME-sh
   ```

Now with each shell login will have access to the same `ssh-agent` and the private key `id_rsa` is ready to use for any auth'ed git command.
</div>
