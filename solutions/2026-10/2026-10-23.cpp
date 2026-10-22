#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
void solve(){
    string s;cin>>s;
    vector<int>stk;
    int n=s.size();
    s="&"+s;
    int las=0;
    bool f=false;
    for(int i=1;i<=n;i++){
        char c=s[i];
        if(c=='('||c==')'){
            if(!stk.empty()&&(s[stk.back()]==')'||s[stk.back()]=='(')) {
                if(stk.back()+1==i) f=true;
                stk.pop_back();
            }
            else stk.emplace_back(i);
        }
        else{
            if(!stk.empty()&&(s[stk.back()]==']'||s[stk.back()]=='[')) {
                if(stk.back()+1==i) f=true;
                stk.pop_back();
            }
            else stk.emplace_back(i);
        }
        if(stk.empty()){
            int len=i-las;
            if(len>2&&f){
                cout<<"No"<<endl;
                return;
            }
            las=i;
            f=false;
        }
        cout<<las<<' ';
    }
    cout<<endl;
    cout<<"Yes"<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;cin>>T;
    while(T--) solve();
    return 0;
}